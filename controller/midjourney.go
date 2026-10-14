package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// midjourneyPollSummary is the result recorded on a midjourney_poll system task
// row, summarizing one polling pass.
type midjourneyPollSummary struct {
	UnfinishedTasks int `json:"unfinished_tasks"`
	ChannelsScanned int `json:"channels_scanned"`
	NullTasksFailed int `json:"null_tasks_failed"`
}

// runMidjourneyTaskUpdateOnce performs one Midjourney polling pass synchronously.
// It honors ctx cancellation (the system-task runner cancels it when the lease
// is lost) and, when report is non-nil, reports progress as (processedChannels,
// totalChannels) so the system task surfaces a percentage.
func runMidjourneyTaskUpdateOnce(ctx context.Context, report func(processed, total int)) midjourneyPollSummary {
	summary := midjourneyPollSummary{}
	if ctx == nil {
		ctx = context.Background()
	}

	tasks := model.GetAllUnFinishTasks()
	if len(tasks) == 0 {
		return summary
	}
	summary.UnfinishedTasks = len(tasks)

	logger.LogInfo(ctx, common.LogText("unfinished tasks found: %v", len(tasks)))
	taskChannelM := make(map[int][]string)
	taskM := make(map[string]*model.Midjourney)
	nullTaskIds := make([]int, 0)
	for _, task := range tasks {
		if task.MjId == "" {
			// 统计失败的未完成任务
			nullTaskIds = append(nullTaskIds, task.Id)
			continue
		}
		taskM[task.MjId] = task
		taskChannelM[task.ChannelId] = append(taskChannelM[task.ChannelId], task.MjId)
	}
	if len(nullTaskIds) > 0 {
		summary.NullTasksFailed = len(nullTaskIds)
		err := model.MjBulkUpdateByTaskIds(nullTaskIds, map[string]any{
			"status":   "FAILURE",
			"progress": "100%",
		})
		if err != nil {
			logger.LogError(ctx, common.LogText("Fix null mj_id task error: %v", err))
		} else {
			logger.LogInfo(ctx, common.LogText("Fix null mj_id task success: %v", nullTaskIds))
		}
	}
	if len(taskChannelM) == 0 {
		return summary
	}

	totalChannels := len(taskChannelM)
	processedChannels := 0
	for channelId, taskIds := range taskChannelM {
		if ctx != nil && ctx.Err() != nil {
			break
		}
		if report != nil {
			report(processedChannels, totalChannels)
		}
		processedChannels++
		summary.ChannelsScanned++
		logger.LogInfo(ctx, common.LogText("channel #%d has %d unfinished tasks", channelId, len(taskIds)))
		if len(taskIds) == 0 {
			continue
		}
		midjourneyChannel, err := model.CacheGetChannel(channelId)
		if err != nil {
			logger.LogError(ctx, common.LogText("CacheGetChannel: %v", err))
			err := model.MjBulkUpdate(taskIds, map[string]any{
				"fail_reason": "Failed to get the channel information. Please contact the administrator",
				"status":      "FAILURE",
				"progress":    "100%",
			})
			if err != nil {
				logger.LogInfo(ctx, common.LogText("UpdateMidjourneyTask error: %v", err))
			}
			continue
		}
		requestUrl := fmt.Sprintf("%s/mj/task/list-by-condition", *midjourneyChannel.BaseURL)

		body, err := common.Marshal(map[string]any{
			"ids": taskIds,
		})
		if err != nil {
			logger.LogError(ctx, common.LogText("Get Task marshal body error: %v", err))
			continue
		}
		timeout := time.Second * 15
		requestCtx, cancel := context.WithTimeout(ctx, timeout)
		req, err := http.NewRequestWithContext(requestCtx, "POST", requestUrl, bytes.NewBuffer(body))
		if err != nil {
			cancel()
			logger.LogError(ctx, common.LogText("Get Task error: %v", err))
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("mj-api-secret", midjourneyChannel.Key)
		resp, err := service.GetHttpClient().Do(req)
		if err != nil {
			logger.LogError(ctx, common.LogText("Get Task Do req error: %v", err))
			cancel()
			continue
		}
		if resp.StatusCode != http.StatusOK {
			logger.LogError(ctx, common.LogText("Get Task status code: %d", resp.StatusCode))
			resp.Body.Close()
			cancel()
			continue
		}
		responseBody, err := io.ReadAll(resp.Body)
		if err != nil {
			logger.LogError(ctx, common.LogText("Get Mjp Task parse body error: %v", err))
			resp.Body.Close()
			cancel()
			continue
		}
		responseItems, responseRaws, err := service.ParseMidjourneyTaskList(responseBody)
		if err != nil {
			logger.LogError(ctx, common.LogText("Get Mjp Task parse body error2: %v, body: %s", err, string(responseBody)))
			resp.Body.Close()
			cancel()
			continue
		}
		resp.Body.Close()
		req.Body.Close()
		cancel()

		for i, responseItem := range responseItems {
			task := taskM[responseItem.MjId]
			if task == nil {
				logger.LogWarn(ctx, common.LogText("Midjourney task response ignored: unknown mj_id=%s", responseItem.MjId))
				continue
			}
			var upstreamRaw []byte
			if i < len(responseRaws) {
				upstreamRaw = responseRaws[i]
			}

			useTime := (time.Now().UnixNano() / int64(time.Millisecond)) - task.SubmitTime
			// 如果时间超过一小时，且进度不是100%，则认为任务失败
			if useTime > 3600000 && task.Progress != "100%" {
				responseItem.FailReason = "Upstream task timed out (over 1 hour)"
				responseItem.Status = "FAILURE"
			}
			service.ApplyMidjourneyUpstreamItem(ctx, task, responseItem, upstreamRaw)
		}
	}
	if report != nil && (ctx == nil || ctx.Err() == nil) {
		report(totalChannels, totalChannels)
	}
	return summary
}

func GetAllMidjourney(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

	// 解析其他查询参数
	queryParams := model.TaskQueryParams{
		ChannelID:      c.Query("channel_id"),
		MjID:           c.Query("mj_id"),
		StartTimestamp: c.Query("start_timestamp"),
		EndTimestamp:   c.Query("end_timestamp"),
	}

	items := model.GetAllTasks(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	service.FillMidjourneyUpstreamPayloads(items)
	total := model.CountAllTasks(queryParams)

	if setting.MjForwardUrlEnabled {
		for i, midjourney := range items {
			if midjourney != nil && !midjourney.MediaStored {
				midjourney.ImageUrl = system_setting.ServerAddress + "/mj/image/" + midjourney.MjId
				items[i] = midjourney
			}
		}
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetUserMidjourney(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

	userId := c.GetInt("id")

	queryParams := model.TaskQueryParams{
		MjID:           c.Query("mj_id"),
		StartTimestamp: c.Query("start_timestamp"),
		EndTimestamp:   c.Query("end_timestamp"),
	}

	items := model.GetAllUserTask(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	service.FillMidjourneyUpstreamPayloads(items)
	total := model.CountAllUserTask(userId, queryParams)

	if setting.MjForwardUrlEnabled {
		for i, midjourney := range items {
			if midjourney != nil && !midjourney.MediaStored {
				midjourney.ImageUrl = system_setting.ServerAddress + "/mj/image/" + midjourney.MjId
				items[i] = midjourney
			}
		}
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}
