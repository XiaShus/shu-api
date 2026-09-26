package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// PrepareMidjourneyTaskBilling sets the durable refund marker before the task is inserted.
func PrepareMidjourneyTaskBilling(relayInfo *relaycommon.RelayInfo, task *model.Midjourney, quota int, shouldBill bool) (bool, error) {
	if task == nil {
		return false, errors.New("Midjourney task is nil")
	}
	task.Quota = 0
	task.TokenId = 0
	task.BillingChannelId = 0
	if !shouldBill {
		return false, nil
	}
	if relayInfo == nil {
		return false, errors.New("relay info is nil")
	}
	if quota < 0 {
		return false, errors.New("quota cannot be negative")
	}
	if relayInfo.BillingSource == BillingSourceSubscription {
		return false, errors.New("legacy Midjourney billing does not support subscriptions")
	}

	task.Quota = quota
	task.BillingChannelId = task.ChannelId
	if relayInfo.ChannelMeta != nil && relayInfo.ChannelId > 0 {
		task.BillingChannelId = relayInfo.ChannelId
	}
	return true, nil
}

// SettleMidjourneyTaskBilling charges a persisted legacy task and records the applied stages.
func SettleMidjourneyTaskBilling(relayInfo *relaycommon.RelayInfo, task *model.Midjourney, prepared bool) (bool, error) {
	if !prepared {
		return false, nil
	}
	if relayInfo == nil {
		return false, errors.New("relay info is nil")
	}
	if task == nil || task.Id == 0 {
		return false, errors.New("Midjourney task must be persisted before billing")
	}

	result, billingErr := postConsumeQuotaWithResult(relayInfo, task.Quota, 0, true)
	if !result.FundingApplied {
		task.Quota = 0
		task.TokenId = 0
		task.BillingChannelId = 0
		if updateErr := task.UpdateBillingState(); updateErr != nil {
			return false, errors.Join(billingErr, fmt.Errorf("clear Midjourney billing state: %w", updateErr))
		}
		return false, billingErr
	}

	task.TokenId = 0
	if result.TokenApplied {
		task.TokenId = relayInfo.TokenId
	}
	if updateErr := task.UpdateBillingState(); updateErr != nil {
		return true, errors.Join(billingErr, fmt.Errorf("update Midjourney billing state: %w", updateErr))
	}
	return true, billingErr
}

// RefundMidjourneyQuota reverses every accounting element recorded for a billed legacy task.
func RefundMidjourneyQuota(ctx context.Context, task *model.Midjourney, reason string) bool {
	quota := task.Quota
	if quota == 0 {
		return true
	}

	if err := model.IncreaseUserQuota(task.UserId, quota, false); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("退还 Midjourney 用户额度失败 task %s: %s", task.MjId, err.Error()))
		return false
	}

	if task.TokenId > 0 {
		tokenKey := resolveTokenKey(ctx, task.TokenId, task.MjId)
		if tokenKey != "" {
			if err := model.IncreaseTokenQuota(task.TokenId, tokenKey, quota); err != nil {
				logger.LogWarn(ctx, fmt.Sprintf("退还 Midjourney 令牌额度失败 task %s: %s", task.MjId, err.Error()))
			}
		}
	}

	billingChannelId := task.GetBillingChannelId()
	model.UpdateUserUsedQuota(task.UserId, -quota)
	model.UpdateChannelUsedQuota(billingChannelId, -quota)
	other := model.NewLogOther()
	other.SetPublic("task_id", task.MjId)
	other.SetPublic("reason", reason)
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   model.LogTypeRefund,
		Content:   "",
		ChannelId: billingChannelId,
		ModelName: CovertMjpActionToModelName(task.Action),
		Quota:     quota,
		TokenId:   task.TokenId,
		Other:     other,
	})

	task.Quota = 0
	if err := task.UpdateBillingState(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Midjourney 退款成功但清除 quota 失败 task %s: %s", task.MjId, err.Error()))
	}
	return true
}

func GetMjRequestModel(relayMode int, midjRequest *dto.MidjourneyRequest) (string, *dto.MidjourneyResponse, bool) {
	action := ""
	if relayMode == relayconstant.RelayModeMidjourneyAction {
		// plus request
		err := CoverPlusActionToNormalAction(midjRequest)
		if err != nil {
			return "", err, false
		}
		action = midjRequest.Action
	} else {
		switch relayMode {
		case relayconstant.RelayModeMidjourneyImagine:
			action = constant.MjActionImagine
		case relayconstant.RelayModeMidjourneyVideo:
			action = constant.MjActionVideo
		case relayconstant.RelayModeMidjourneyEdits:
			action = constant.MjActionEdits
		case relayconstant.RelayModeMidjourneyRetexture:
			action = constant.MjActionRetexture
		case relayconstant.RelayModeMidjourneyDescribe:
			action = constant.MjActionDescribe
		case relayconstant.RelayModeMidjourneyBlend:
			action = constant.MjActionBlend
		case relayconstant.RelayModeMidjourneyShorten:
			action = constant.MjActionShorten
		case relayconstant.RelayModeMidjourneyChange:
			action = midjRequest.Action
		case relayconstant.RelayModeMidjourneyModal:
			action = constant.MjActionModal
		case relayconstant.RelayModeSwapFace:
			action = constant.MjActionSwapFace
		case relayconstant.RelayModeSwapVideoFace:
			action = constant.MjActionSwapVideoFace
		case relayconstant.RelayModeMidjourneyUpload:
			action = constant.MjActionUpload
		case relayconstant.RelayModeMidjourneySimpleChange:
			params := ConvertSimpleChangeParams(midjRequest.Content)
			if params == nil {
				return "", MidjourneyErrorWrapper(constant.MjRequestError, "invalid_request"), false
			}
			action = params.Action
		case relayconstant.RelayModeMidjourneyTaskFetch, relayconstant.RelayModeMidjourneyTaskFetchByCondition, relayconstant.RelayModeMidjourneyNotify, relayconstant.RelayModeMidjourneyTaskCancel:
			return "", nil, true
		default:
			return "", MidjourneyErrorWrapper(constant.MjRequestError, "unknown_relay_action"), false
		}
	}
	modelName := CovertMjpActionToModelName(action)
	return modelName, nil, true
}

func CoverPlusActionToNormalAction(midjRequest *dto.MidjourneyRequest) *dto.MidjourneyResponse {
	// "customId": "MJ::JOB::upsample::2::3dbbd469-36af-4a0f-8f02-df6c579e7011"
	customId := midjRequest.CustomId
	if customId == "" {
		return MidjourneyErrorWrapper(constant.MjRequestError, "custom_id_is_required")
	}
	splits := strings.Split(customId, "::")
	if len(splits) < 2 {
		return MidjourneyErrorWrapper(constant.MjRequestError, "unknown_action")
	}
	var action string
	if splits[1] == "JOB" {
		action = splits[2]
	} else {
		action = splits[1]
	}

	if action == "" {
		return MidjourneyErrorWrapper(constant.MjRequestError, "unknown_action")
	}
	if strings.Contains(action, "upsample") {
		index, err := strconv.Atoi(splits[3])
		if err != nil {
			return MidjourneyErrorWrapper(constant.MjRequestError, "index_parse_failed")
		}
		midjRequest.Index = index
		midjRequest.Action = constant.MjActionUpscale
	} else if strings.Contains(action, "variation") {
		midjRequest.Index = 1
		if action == "variation" {
			index, err := strconv.Atoi(splits[3])
			if err != nil {
				return MidjourneyErrorWrapper(constant.MjRequestError, "index_parse_failed")
			}
			midjRequest.Index = index
			midjRequest.Action = constant.MjActionVariation
		} else if action == "low_variation" {
			midjRequest.Action = constant.MjActionLowVariation
		} else if action == "high_variation" {
			midjRequest.Action = constant.MjActionHighVariation
		}
	} else if strings.Contains(action, "pan") {
		midjRequest.Action = constant.MjActionPan
		midjRequest.Index = 1
	} else if strings.Contains(action, "reroll") {
		midjRequest.Action = constant.MjActionReRoll
		midjRequest.Index = 1
	} else if action == "Outpaint" {
		midjRequest.Action = constant.MjActionZoom
		midjRequest.Index = 1
	} else if action == "CustomZoom" {
		midjRequest.Action = constant.MjActionCustomZoom
		midjRequest.Index = 1
	} else if action == "Inpaint" {
		midjRequest.Action = constant.MjActionInPaint
		midjRequest.Index = 1
	} else if strings.Contains(strings.ToLower(action), "video") || strings.Contains(strings.ToLower(action), "animate") {
		midjRequest.Action = constant.MjActionVideo
		midjRequest.Index = 1
	} else if strings.Contains(strings.ToLower(action), "retexture") {
		midjRequest.Action = constant.MjActionRetexture
		midjRequest.Index = 1
	} else if strings.EqualFold(action, "edit") {
		midjRequest.Action = constant.MjActionEdits
		midjRequest.Index = 1
	} else {
		return MidjourneyErrorWrapper(constant.MjRequestError, "unknown_action:"+customId)
	}
	return nil
}

func ConvertSimpleChangeParams(content string) *dto.MidjourneyRequest {
	split := strings.Split(content, " ")
	if len(split) != 2 {
		return nil
	}

	action := strings.ToLower(split[1])
	changeParams := &dto.MidjourneyRequest{}
	changeParams.TaskId = split[0]

	if action[0] == 'u' {
		changeParams.Action = "UPSCALE"
	} else if action[0] == 'v' {
		changeParams.Action = "VARIATION"
	} else if action == "r" {
		changeParams.Action = "REROLL"
		return changeParams
	} else {
		return nil
	}

	index, err := strconv.Atoi(action[1:2])
	if err != nil || index < 1 || index > 4 {
		return nil
	}
	changeParams.Index = index
	return changeParams
}

// RecordMidjourneyPolicyResponse distinguishes accepted tasks from errors inside
// HTTP 200 responses. Submissions are single-attempt: an ambiguous transport
// failure must never create a duplicate task on another channel.
func RecordMidjourneyPolicyResponse(c *gin.Context, response *dto.MidjourneyResponseWithStatusCode, requestErr error) bool {
	if response == nil {
		response = MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "empty_response", http.StatusBadGateway)
	}
	accepted := requestErr == nil && response.StatusCode == http.StatusOK && (response.Response.Code == 1 || response.Response.Code == 21 || response.Response.Code == 22)
	if accepted {
		properties, _ := response.Response.Properties.(map[string]any)
		if properties["status"] != "FAILURE" {
			return true
		}
	}
	state := RequestPolicy(c)
	event := PolicyEvent{ChannelID: c.GetInt("channel_id"), Status: response.StatusCode, ErrorCode: strconv.Itoa(response.Response.Code), ErrorSource: "upstream", Decision: PolicyDecision{Action: "failure", Reason: "upstream_failure", Source: "upstream"}}
	state.AddEvent(event)
	event.Decision, event.Health = PolicyDecision{Action: "stop", Reason: "non_retryable_error", Source: "system"}, "unchanged"
	if accepted {
		event.Decision.Reason = "task_accepted"
	}
	state.AddEvent(event)
	return false
}

func midjourneyUnmarshalFailed(statusCode int, body []byte, err error, requestURL string) (*dto.MidjourneyResponseWithStatusCode, []byte, error) {
	preview := strings.ToValidUTF8(string(body), "")
	if len(preview) > 256 {
		preview = preview[:256]
	}
	desc := describeMidjourneyNonJSONBody(statusCode, body)
	common.SysLog(fmt.Sprintf("midjourney unmarshal failed: status=%d url=%s err=%v desc=%s body=%q", statusCode, relaycommon.SanitizeURLForLog(requestURL), err, desc, preview))
	return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, desc, statusCode), body, err
}

func describeMidjourneyNonJSONBody(statusCode int, body []byte) string {
	trimmed := bytes.TrimSpace(body)
	lower := bytes.ToLower(trimmed)
	isHTML := bytes.HasPrefix(lower, []byte("<!doctype html")) || bytes.Contains(lower, []byte("<html"))
	if !isHTML {
		return fmt.Sprintf("unmarshal_response_body_failed (status %d)", statusCode)
	}
	text := string(body)
	if strings.Contains(text, "域名尚未添加至白名单") || strings.Contains(text, "请勿直接使用IP") {
		return "upstream_blocked: 上游返回机房域名白名单拦截页，请把渠道 API 地址改成已加白名单的域名，不要用 IP 访问"
	}
	if _, title, ok := strings.Cut(text, "<title>"); ok {
		if title, _, ok = strings.Cut(title, "</title>"); ok {
			title = strings.TrimSpace(title)
			if title != "" {
				return fmt.Sprintf("upstream_returned_html (status %d): %s", statusCode, title)
			}
		}
	}
	return fmt.Sprintf("upstream_returned_html (status %d)", statusCode)
}

func DoMidjourneyHttpRequest(c *gin.Context, timeout time.Duration, fullRequestURL string) (*dto.MidjourneyResponseWithStatusCode, []byte, error) {
	var nullBytes []byte
	//var requestBody io.Reader
	//requestBody = c.Request.Body
	// read request body to json, delete accountFilter and notifyHook
	var mapResult map[string]any
	// if get request, no need to read request body
	if c.Request.Method != "GET" {
		contentType := c.Request.Header.Get("Content-Type")
		if strings.HasPrefix(strings.ToLower(contentType), "multipart/") {
			return DoMidjourneyRawHttpRequest(c, timeout, fullRequestURL)
		}
		bodyReader, readErr := common.GetRequestBody(c)
		if readErr != nil {
			return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_request_body_failed", http.StatusInternalServerError), nullBytes, readErr
		}
		reader, ok := bodyReader.(io.Reader)
		if !ok {
			return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_request_body_failed", http.StatusInternalServerError), nullBytes, fmt.Errorf("request body is not readable")
		}
		raw, readErr := io.ReadAll(reader)
		if readErr != nil {
			return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_request_body_failed", http.StatusInternalServerError), nullBytes, readErr
		}
		if len(bytes.TrimSpace(raw)) == 0 {
			mapResult = map[string]any{}
		} else {
			err := common.Unmarshal(raw, &mapResult)
			if err != nil {
				return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_request_body_failed", http.StatusInternalServerError), nullBytes, err
			}
		}
		if !setting.MjAccountFilterEnabled {
			delete(mapResult, "accountFilter")
		}
		if !setting.MjNotifyEnabled {
			delete(mapResult, "notifyHook")
		}
	}
	var reqBody []byte
	if c.Request.Method != http.MethodGet {
		if setting.MjModeClearEnabled && !setting.MjModePathPrefixEnabled {
			if prompt, ok := mapResult["prompt"].(string); ok {
				prompt = strings.Replace(prompt, "--fast", "", -1)
				prompt = strings.Replace(prompt, "--relax", "", -1)
				prompt = strings.Replace(prompt, "--turbo", "", -1)

				mapResult["prompt"] = prompt
			}
		}
		var marshalErr error
		reqBody, marshalErr = common.Marshal(mapResult)
		if marshalErr != nil {
			return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "marshal_request_body_failed", http.StatusInternalServerError), nullBytes, marshalErr
		}
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, strings.NewReader(string(reqBody)))
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "create_request_failed", http.StatusInternalServerError), nullBytes, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	// 使用带有超时的 context 创建新的请求
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	req.Header.Set("Accept", c.Request.Header.Get("Accept"))
	auth := common.GetContextKeyString(c, constant.ContextKeyChannelKey)
	if auth != "" {
		auth = strings.TrimPrefix(auth, "Bearer ")
		req.Header.Set("mj-api-secret", auth)
	}
	defer cancel()
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		common.SysLog("do request failed: " + err.Error())
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "do_request_failed", http.StatusInternalServerError), nullBytes, err
	}
	statusCode := resp.StatusCode
	//if statusCode != 200  {
	//	return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "bad_response_status_code", statusCode), nullBytes, nil
	//}
	err = req.Body.Close()
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "close_request_body_failed", statusCode), nullBytes, err
	}
	err = c.Request.Body.Close()
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "close_request_body_failed", statusCode), nullBytes, err
	}
	var midjResponse dto.MidjourneyResponse
	var midjourneyUploadsResponse dto.MidjourneyUploadResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_response_body_failed", statusCode), nullBytes, err
	}
	CloseResponseBodyGracefully(resp)
	logger.LogDebug(c, "midjourney response body: %s", responseBody)
	if len(responseBody) == 0 {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "empty_response_body", statusCode), responseBody, nil
	} else {
		err = common.Unmarshal(responseBody, &midjResponse)
		if err != nil {
			err2 := common.Unmarshal(responseBody, &midjourneyUploadsResponse)
			if err2 != nil {
				return midjourneyUnmarshalFailed(statusCode, responseBody, err, fullRequestURL)
			}
		}
	}
	//for k, v := range resp.Header {
	//	c.Writer.Header().Set(k, v[0])
	//}
	return &dto.MidjourneyResponseWithStatusCode{
		StatusCode: statusCode,
		Response:   midjResponse,
	}, responseBody, nil
}

func DoMidjourneyRawHttpRequest(c *gin.Context, timeout time.Duration, fullRequestURL string) (*dto.MidjourneyResponseWithStatusCode, []byte, error) {
	var nullBytes []byte
	bodyReader, err := common.GetRequestBody(c)
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_request_body_failed", http.StatusInternalServerError), nullBytes, err
	}
	reader, ok := bodyReader.(io.Reader)
	if !ok {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_request_body_failed", http.StatusInternalServerError), nullBytes, fmt.Errorf("request body is not readable")
	}
	raw, err := io.ReadAll(reader)
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_request_body_failed", http.StatusInternalServerError), nullBytes, err
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, bytes.NewReader(raw))
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "create_request_failed", http.StatusInternalServerError), nullBytes, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	req.Header.Set("Accept", c.Request.Header.Get("Accept"))
	auth := common.GetContextKeyString(c, constant.ContextKeyChannelKey)
	if auth != "" {
		auth = strings.TrimPrefix(auth, "Bearer ")
		req.Header.Set("mj-api-secret", auth)
	}
	defer cancel()
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		common.SysLog("do request failed: " + err.Error())
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "do_request_failed", http.StatusInternalServerError), nullBytes, err
	}
	statusCode := resp.StatusCode
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_response_body_failed", statusCode), nullBytes, err
	}
	CloseResponseBodyGracefully(resp)
	var midjResponse dto.MidjourneyResponse
	if len(responseBody) == 0 {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "empty_response_body", statusCode), responseBody, nil
	}
	if unmarshalErr := common.Unmarshal(responseBody, &midjResponse); unmarshalErr != nil {
		return midjourneyUnmarshalFailed(statusCode, responseBody, unmarshalErr, fullRequestURL)
	}
	return &dto.MidjourneyResponseWithStatusCode{
		StatusCode: statusCode,
		Response:   midjResponse,
	}, responseBody, nil
}

func ParseMidjourneyTaskList(body []byte) ([]dto.MidjourneyDto, [][]byte, error) {
	var raws []json.RawMessage
	if err := common.Unmarshal(body, &raws); err != nil {
		return nil, nil, err
	}
	items := make([]dto.MidjourneyDto, 0, len(raws))
	copies := make([][]byte, 0, len(raws))
	for _, raw := range raws {
		var item dto.MidjourneyDto
		if err := common.Unmarshal(raw, &item); err != nil {
			return nil, nil, err
		}
		items = append(items, item)
		copies = append(copies, append([]byte(nil), raw...))
	}
	return items, copies, nil
}

func RememberMidjourneyUpstream(task *model.Midjourney, raw []byte) {
	if task == nil {
		return
	}
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || raw[0] != '{' {
		return
	}
	var obj map[string]any
	if err := common.Unmarshal(raw, &obj); err != nil || obj == nil {
		return
	}
	task.Payload = model.LongText(raw)
}

func MidjourneyPayloadChanged(task *model.Midjourney, raw []byte) bool {
	if task == nil {
		return false
	}
	return strings.TrimSpace(string(task.Payload)) != strings.TrimSpace(string(raw))
}

func MarshalMidjourneyTaskResponse(origin *model.Midjourney, presented dto.MidjourneyDto) ([]byte, error) {
	encoded, err := common.Marshal(presented)
	if err != nil {
		return nil, err
	}
	if origin == nil || strings.TrimSpace(string(origin.Payload)) == "" {
		return encoded, nil
	}
	var upstream map[string]any
	if err := common.Unmarshal([]byte(origin.Payload), &upstream); err != nil || upstream == nil {
		return encoded, nil
	}
	var ours map[string]any
	if err := common.Unmarshal(encoded, &ours); err != nil {
		return encoded, nil
	}
	overlayMidjourneyFields(upstream, ours)
	return common.Marshal(upstream)
}

func MarshalMidjourneyTaskArray(parts [][]byte) ([]byte, error) {
	if len(parts) == 0 {
		return []byte("[]"), nil
	}
	var b strings.Builder
	b.WriteByte('[')
	for i, part := range parts {
		if i > 0 {
			b.WriteByte(',')
		}
		b.Write(part)
	}
	b.WriteByte(']')
	return []byte(b.String()), nil
}

func overlayMidjourneyFields(dst, src map[string]any) {
	for key, value := range src {
		if midjourneyJSONEmpty(value) {
			continue
		}
		if srcMap, ok := value.(map[string]any); ok {
			if dstMap, ok := dst[key].(map[string]any); ok {
				overlayMidjourneyFields(dstMap, srcMap)
				continue
			}
		}
		dst[key] = value
	}
}

func midjourneyJSONEmpty(value any) bool {
	if value == nil {
		return true
	}
	switch typed := value.(type) {
	case string:
		return typed == ""
	case float64:
		return typed == 0
	case []any:
		return len(typed) == 0
	case map[string]any:
		return len(typed) == 0
	default:
		return false
	}
}

func FillMidjourneyUpstreamPayloads(tasks []*model.Midjourney) {
	pending := make(map[int][]*model.Midjourney)
	for _, task := range tasks {
		if task == nil || task.ChannelId == 0 || task.MjId == "" || strings.TrimSpace(string(task.Payload)) != "" {
			continue
		}
		pending[task.ChannelId] = append(pending[task.ChannelId], task)
	}
	for channelID, group := range pending {
		fillMidjourneyChannelPayloads(channelID, group)
	}
}

func fillMidjourneyChannelPayloads(channelID int, tasks []*model.Midjourney) {
	channel, err := model.CacheGetChannel(channelID)
	if err != nil || channel == nil || channel.BaseURL == nil || *channel.BaseURL == "" {
		return
	}
	ids := make([]string, 0, len(tasks))
	byID := make(map[string]*model.Midjourney, len(tasks))
	for _, task := range tasks {
		ids = append(ids, task.MjId)
		byID[task.MjId] = task
	}
	body, err := common.Marshal(map[string]any{"ids": ids})
	if err != nil {
		return
	}
	requestURL := fmt.Sprintf("%s/mj/task/list-by-condition", *channel.BaseURL)
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("mj-api-secret", channel.Key)
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("midjourney payload refresh failed: %v", err))
		return
	}
	defer CloseResponseBodyGracefully(resp)
	if resp.StatusCode != http.StatusOK {
		logger.LogError(ctx, fmt.Sprintf("midjourney payload refresh status: %d", resp.StatusCode))
		return
	}
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}
	items, raws, err := ParseMidjourneyTaskList(responseBody)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("midjourney payload refresh parse: %v", err))
		return
	}
	for i, item := range items {
		task := byID[item.MjId]
		if task == nil || i >= len(raws) {
			continue
		}
		RememberMidjourneyUpstream(task, raws[i])
		if strings.TrimSpace(string(task.Payload)) == "" {
			continue
		}
		if err := task.UpdatePayload(); err != nil {
			logger.LogError(ctx, fmt.Sprintf("midjourney payload save failed: %v", err))
		}
	}
}
