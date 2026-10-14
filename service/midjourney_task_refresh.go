package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

// midjourneyTaskQueryTimeout bounds one upstream task query. It matches the
// per-channel timeout of the scheduled poller.
const midjourneyTaskQueryTimeout = 15 * time.Second

// ApplyMidjourneyUpstreamItem merges one upstream task item into its stored row.
// It is the single write path for Midjourney task state: the scheduled poller
// and the synchronous image bridge both land here, so status, media bookkeeping
// and refunds stay identical no matter who observed the completion.
func ApplyMidjourneyUpstreamItem(ctx context.Context, task *model.Midjourney, item dto.MidjourneyDto, upstreamRaw []byte) {
	if task == nil {
		return
	}
	if !checkMidjourneyTaskNeedUpdate(task, item, upstreamRaw) {
		return
	}
	preStatus := task.Status
	task.Code = 1
	task.Progress = item.Progress
	task.PromptEn = item.PromptEn
	task.State = item.State
	task.SubmitTime = item.SubmitTime
	task.StartTime = item.StartTime
	task.FinishTime = item.FinishTime
	task.ImageUrl = item.ImageUrl
	task.Status = item.Status
	task.FailReason = item.FailReason
	if item.Properties != nil {
		propertiesStr, _ := common.Marshal(item.Properties)
		task.Properties = string(propertiesStr)
	}
	if item.Buttons != nil {
		buttonStr, _ := common.Marshal(item.Buttons)
		task.Buttons = string(buttonStr)
	}
	// 映射 VideoUrl
	task.VideoUrl = item.VideoUrl

	// 映射 VideoUrls - 将数组序列化为 JSON 字符串
	if len(item.VideoUrls) > 0 {
		videoUrlsStr, err := common.Marshal(item.VideoUrls)
		if err != nil {
			logger.LogError(ctx, common.LogText("failed to serialize VideoUrls: %v", err))
			task.VideoUrls = "[]" // 失败时设置为空数组
		} else {
			task.VideoUrls = string(videoUrlsStr)
		}
	} else {
		task.VideoUrls = "" // 空值时清空字段
	}

	RememberMidjourneyUpstream(task, upstreamRaw)
	logMidjourneyModeMismatch(ctx, task, item)
	if item.Status == "SUCCESS" {
		PersistMidjourneyMedia(task)
	}

	// A task with no reserved quota was never charged through the legacy
	// Midjourney billing path, so there is nothing to give back.
	shouldReturnQuota := false
	terminalFail := IsMidjourneyTerminalFailureStatus(task.Status)
	if (task.Progress != "100%" && item.FailReason != "") || (task.Progress == "100%" && terminalFail) {
		logger.LogInfo(ctx, common.LogText("%s failed: %s", task.MjId, task.FailReason))
		task.Progress = "100%"
		if task.Quota != 0 {
			shouldReturnQuota = true
		}
	}
	won, err := task.UpdateWithStatus(preStatus)
	if err != nil {
		logger.LogError(ctx, common.LogText("UpdateMidjourneyTask task error: %s", err.Error()))
	} else if won && shouldReturnQuota {
		RefundMidjourneyQuota(ctx, task, "Composition failed")
	}
}

// RefreshMidjourneyTask queries the task's own channel for the upstream state of
// one task and applies it to the row in place. A task the upstream has not
// published yet is not an error: the row is left untouched and the caller may
// query again. Callers must inspect task.Status and task.ImageUrl afterwards.
func RefreshMidjourneyTask(ctx context.Context, task *model.Midjourney) error {
	if task == nil {
		return errors.New("midjourney task is nil")
	}
	if strings.TrimSpace(task.MjId) == "" {
		return errors.New("midjourney task has no upstream id")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	channel, err := model.CacheGetChannel(task.ChannelId)
	if err != nil {
		return fmt.Errorf("get channel info failed: %w", err)
	}
	baseURL := strings.TrimRight(channel.GetBaseURL(), "/")
	if baseURL == "" {
		return errors.New("midjourney channel has no base url")
	}
	requestBody, err := common.Marshal(map[string]any{"ids": []string{task.MjId}})
	if err != nil {
		return fmt.Errorf("marshal task query failed: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, midjourneyTaskQueryTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, baseURL+"/mj/task/list-by-condition", bytes.NewReader(requestBody))
	if err != nil {
		return fmt.Errorf("create task query failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("mj-api-secret", channel.Key)

	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return fmt.Errorf("task query failed: %w", err)
	}
	defer CloseResponseBodyGracefully(resp)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("task query returned status %d", resp.StatusCode)
	}
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read task query response failed: %w", err)
	}
	items, raws, err := ParseMidjourneyTaskList(responseBody)
	if err != nil {
		return fmt.Errorf("parse task query response failed: %w", err)
	}
	for i, item := range items {
		if item.MjId != task.MjId {
			continue
		}
		var upstreamRaw []byte
		if i < len(raws) {
			upstreamRaw = raws[i]
		}
		ApplyMidjourneyUpstreamItem(ctx, task, item, upstreamRaw)
		return nil
	}
	return nil
}

// IsMidjourneyTerminalFailureStatus reports whether an upstream status ends the
// task without an image.
func IsMidjourneyTerminalFailureStatus(status string) bool {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "FAILURE", "CANCEL", "CANCELED", "CANCELLED":
		return true
	default:
		return false
	}
}

func checkMidjourneyTaskNeedUpdate(oldTask *model.Midjourney, newTask dto.MidjourneyDto, upstreamRaw []byte) bool {
	if oldTask.Code != 1 {
		return true
	}
	if oldTask.Progress != newTask.Progress {
		return true
	}
	if oldTask.PromptEn != newTask.PromptEn {
		return true
	}
	if oldTask.State != newTask.State {
		return true
	}
	if oldTask.SubmitTime != newTask.SubmitTime {
		return true
	}
	if oldTask.StartTime != newTask.StartTime {
		return true
	}
	if oldTask.FinishTime != newTask.FinishTime {
		return true
	}
	if oldTask.ImageUrl != newTask.ImageUrl {
		return true
	}
	if oldTask.Status != newTask.Status {
		return true
	}
	if oldTask.FailReason != newTask.FailReason {
		return true
	}
	if oldTask.FinishTime != newTask.FinishTime {
		return true
	}
	if oldTask.Progress != "100%" && newTask.FailReason != "" {
		return true
	}
	// 检查 VideoUrl 是否需要更新
	if oldTask.VideoUrl != newTask.VideoUrl {
		return true
	}
	storedMode := NormalizeMjMode(oldTask.Mode)
	upstreamMode := NormalizeMjMode(newTask.Mode)
	if upstreamMode == "" && newTask.Properties != nil {
		upstreamMode = InferMjModeFromPrompt(newTask.Properties.FinalPrompt)
	}
	if storedMode != "" && upstreamMode != "" && storedMode != upstreamMode {
		return true
	}
	// 检查 VideoUrls 是否需要更新
	if len(newTask.VideoUrls) > 0 {
		newVideoUrlsStr, _ := common.Marshal(newTask.VideoUrls)
		if oldTask.VideoUrls != string(newVideoUrlsStr) {
			return true
		}
	} else if oldTask.VideoUrls != "" {
		// 如果新数据没有 VideoUrls 但旧数据有，需要更新（清空）
		return true
	}
	if strings.TrimSpace(string(upstreamRaw)) != "" && MidjourneyPayloadChanged(oldTask, upstreamRaw) {
		return true
	}

	return false
}

func logMidjourneyModeMismatch(ctx context.Context, task *model.Midjourney, item dto.MidjourneyDto) {
	if task == nil {
		return
	}
	stored := NormalizeMjMode(task.Mode)
	upstream := NormalizeMjMode(item.Mode)
	if upstream == "" && item.Properties != nil {
		upstream = InferMjModeFromPrompt(item.Properties.FinalPrompt)
	}
	if stored == "" || upstream == "" || stored == upstream {
		return
	}
	common.SysLog(fmt.Sprintf("midjourney mode mismatch mj_id=%s stored=%s upstream=%s", task.MjId, stored, upstream))
}
