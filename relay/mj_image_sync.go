package relay

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// mjImagineSubmitPath is the Midjourney proxy endpoint that submits an imagine
// task. getMjRequestPath derives the speed-mode prefix from it, and the FAST
// pool deliberately stays on /mj/.
const mjImagineSubmitPath = "/mj/submit/imagine"

// mjSyncImageModel is the only model the synchronous bridge serves.
const mjSyncImageModel = "mj_imagine"

// mjSyncImagePollInterval is one poll round of the synchronous wait. It matches
// the task plugin protocol bridge so both synchronous image paths behave alike.
const mjSyncImagePollInterval = 3 * time.Second

// mjSyncImageDefaultTimeoutSeconds mirrors the MJ_SYNC_IMAGE_TIMEOUT_SECONDS
// default when the environment leaves the value unset.
const mjSyncImageDefaultTimeoutSeconds = 180

// mjSyncImageTimeoutCode is the error code of a wait that expired while the task
// was still running. It matches the task plugin protocol bridge.
const mjSyncImageTimeoutCode types.ErrorCode = "task_timeout"

const (
	mjTaskStatusSuccess = "SUCCESS"
	mjTaskStatusFailure = "FAILURE"
)

// tryMidjourneyImageRelay routes an OpenAI images request that was matched to a
// Midjourney channel into the synchronous bridge. handled is false for every
// request the bridge does not own, which leaves the ordinary image relay — and
// with it the channel types that fall back to the OpenAI adaptor — untouched.
func tryMidjourneyImageRelay(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest) (handled bool, newAPIError *types.NewAPIError) {
	if info == nil {
		return false, nil
	}
	switch info.ChannelType {
	case constant.ChannelTypeMidjourney, constant.ChannelTypeMidjourneyPlus:
	default:
		return false, nil
	}
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations:
		return true, RelayMidjourneyImageSync(c, info, request)
	case relayconstant.RelayModeImagesEdits:
		return true, types.NewErrorWithStatusCode(
			errors.New("Midjourney does not support image edits"),
			types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	default:
		return false, nil
	}
}

// RelayMidjourneyImageSync serves one Midjourney image generation as a
// synchronous OpenAI Images response: it submits a FAST imagine task, waits for
// the upstream result inside the client request, and settles the image billing
// session the relay prepared before channel selection.
func RelayMidjourneyImageSync(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest) *types.NewAPIError {
	if request == nil {
		return midjourneyImageRequestError(errors.New("image request is required"))
	}
	originModel := strings.TrimSpace(info.OriginModelName)
	if originModel != mjSyncImageModel && strings.TrimSpace(request.Model) != mjSyncImageModel {
		return midjourneyImageRequestError(fmt.Errorf("model is not supported on this endpoint: Midjourney image generation supports %s", mjSyncImageModel))
	}
	if request.N != nil && *request.N > 1 {
		return midjourneyImageRequestError(errors.New("n must be 1 for Midjourney image generation"))
	}
	if request.Stream != nil && *request.Stream {
		return midjourneyImageRequestError(errors.New("stream is not supported for Midjourney image generation"))
	}
	prompt := stripMidjourneyModeFlags(request.Prompt)
	if strings.TrimSpace(prompt) == "" {
		return midjourneyImageRequestError(errors.New("prompt is required for Midjourney image generation"))
	}
	// The bridge answers with a single JSON image payload.
	info.IsStream = false

	// Refresh the reservation from the quantity actually submitted: the relay
	// reserved this request before channel selection, and the reservation has to
	// be in place before the charge becomes real upstream.
	if billingErr := service.PrepareImageBillingForRequest(c, info, 1); billingErr != nil {
		return billingErr
	}

	task, submitErr := submitMidjourneyTask(c, info, &taskdto.MidjourneyRequest{
		Prompt: prompt,
		Action: constant.MjActionImagine,
		// accountFilter is only forwarded while the site enables it; the
		// stripped prompt keeps the submission on the default FAST pool either
		// way.
		AccountFilter: &taskdto.MidjourneyAccountFilter{Modes: []string{setting.MjModeFast}},
	}, setting.MjModeFast)
	if submitErr != nil {
		return midjourneyImageUpstreamError(c, submitErr)
	}

	switch waitMidjourneyImageTask(c, task) {
	case mjSyncImageSucceeded:
		body, buildErr := buildMidjourneyImageResponse(c, info, request, task)
		if buildErr != nil {
			return midjourneyImageUpstreamError(c, buildErr)
		}
		c.Data(http.StatusOK, "application/json; charset=utf-8", body)
		info.UpdateImageCount(1)
		finalizeImageRelay(c, info, request, &dto.Usage{})
		return nil
	case mjSyncImageTaskFailed:
		reason := strings.TrimSpace(task.FailReason)
		if reason == "" {
			reason = "Midjourney image generation failed"
		}
		return midjourneyImageUpstreamError(c, errors.New(reason))
	default:
		return settleMidjourneyImageWait(c, info, request, task)
	}
}

// mjSyncImageOutcome is the result of waiting for one Midjourney task.
type mjSyncImageOutcome int

const (
	mjSyncImageSucceeded mjSyncImageOutcome = iota
	mjSyncImageTaskFailed
	mjSyncImageUnfinished
)

// waitMidjourneyImageTask polls the upstream task until it reaches a terminal
// state, the wait expires, or the client goes away. The stored row is updated
// through the same write path the scheduled poller uses.
func waitMidjourneyImageTask(c *gin.Context, task *model.Midjourney) mjSyncImageOutcome {
	timeoutSeconds := constant.MjSyncImageTimeoutSeconds
	if timeoutSeconds <= 0 {
		timeoutSeconds = mjSyncImageDefaultTimeoutSeconds
	}
	if limit := constant.TaskPluginProtocolTimeoutSeconds; limit > 0 && limit < timeoutSeconds {
		timeoutSeconds = limit
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	ticker := time.NewTicker(mjSyncImagePollInterval)
	defer ticker.Stop()
	// A stuck upstream would otherwise emit one warning per poll round for the
	// whole wait, so a repeating failure is logged once.
	lastPollError := ""
	for {
		if err := service.RefreshMidjourneyTask(ctx, task); err != nil {
			if message := common.MaskSensitiveInfo(err.Error()); message != lastPollError {
				lastPollError = message
				logger.LogWarn(c, common.LogText("midjourney image poll failed for task %s: %s", task.MjId, message))
			}
		} else {
			lastPollError = ""
			if task.Status == mjTaskStatusSuccess && strings.TrimSpace(task.ImageUrl) != "" {
				return mjSyncImageSucceeded
			}
			if service.IsMidjourneyTerminalFailureStatus(task.Status) {
				return mjSyncImageTaskFailed
			}
		}

		select {
		case <-ctx.Done():
			return mjSyncImageUnfinished
		case <-ticker.C:
		}
	}
}

// settleMidjourneyImageWait resolves the reservation of a wait that did not see
// a result. Charging is only safe while the scheduled poller can still finish
// the task and deliver the image; without that poller the task would stay
// pending forever, so the reservation is released and the row is closed instead.
func settleMidjourneyImageWait(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest, task *model.Midjourney) *types.NewAPIError {
	if !constant.UpdateTask {
		abandonMidjourneyImageTask(c, task)
		return types.NewErrorWithStatusCode(
			errors.New("Midjourney image generation timed out"),
			mjSyncImageTimeoutCode, http.StatusGatewayTimeout, types.ErrOptionWithSkipRetry())
	}
	info.UpdateImageCount(1)
	finalizeImageRelay(c, info, request, &dto.Usage{})
	return types.NewErrorWithStatusCode(
		fmt.Errorf("Midjourney image generation is still running; task %s settles when it completes", task.MjId),
		mjSyncImageTimeoutCode, http.StatusGatewayTimeout, types.ErrOptionWithSkipRetry())
}

// abandonMidjourneyImageTask closes a row whose result will never be polled, so
// it neither stays "in progress" forever nor keeps the unfinished-task check
// awake.
func abandonMidjourneyImageTask(c *gin.Context, task *model.Midjourney) {
	if task == nil {
		return
	}
	preStatus := task.Status
	task.Status = mjTaskStatusFailure
	task.Progress = "100%"
	task.FailReason = "request timed out"
	if _, err := task.UpdateWithStatus(preStatus); err != nil {
		logger.LogError(c, common.LogText("midjourney timeout bookkeeping failed for task %s: %s", task.MjId, err.Error()))
	}
}

// buildMidjourneyImageResponse renders the stored task as an OpenAI Images
// response body. A failed inline download keeps the upstream URL: the image
// exists and is charged for, so it must not turn into an error response.
func buildMidjourneyImageResponse(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest, task *model.Midjourney) ([]byte, error) {
	created := task.SubmitTime / 1000
	if created <= 0 {
		created = time.Now().Unix()
	}
	image := dto.ImageData{Url: task.ImageUrl}
	if strings.EqualFold(strings.TrimSpace(request.ResponseFormat), "b64_json") {
		_, encoded, err := service.GetImageFromUrl(task.ImageUrl)
		if err != nil {
			logger.LogWarn(c, common.LogText("midjourney image download failed; returning the upstream URL instead of b64_json: %s", common.MaskSensitiveInfo(err.Error())))
		} else if strings.TrimSpace(encoded) != "" {
			image = dto.ImageData{B64Json: encoded}
		}
	}
	body, err := common.Marshal(dto.ImageResponse{Created: created, Data: []dto.ImageData{image}})
	if err != nil {
		return nil, err
	}
	return service.RewriteOpenAIImageResponse(info, body), nil
}

// stripMidjourneyModeFlags removes the upstream speed flags from a prompt so the
// submission cannot be pulled off the FAST pool. Prompts without a flag are
// returned byte for byte.
func stripMidjourneyModeFlags(prompt string) string {
	fields := strings.Fields(prompt)
	if len(fields) == 0 {
		return prompt
	}
	kept := make([]string, 0, len(fields))
	removed := false
	for _, field := range fields {
		switch strings.ToLower(field) {
		case "--fast", "--relax", "--turbo", "--draft":
			removed = true
		default:
			kept = append(kept, field)
		}
	}
	if !removed {
		return prompt
	}
	return strings.Join(kept, " ")
}

func midjourneyImageRequestError(err error) *types.NewAPIError {
	return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
}

// midjourneyImageUpstreamError reports a failure that may already have created a
// paid upstream task: the request must never be retried on another channel.
func midjourneyImageUpstreamError(c *gin.Context, err error) *types.NewAPIError {
	logger.LogError(c, common.LogText("midjourney image generation failed: %s", common.MaskSensitiveInfo(err.Error())))
	return types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway, types.ErrOptionWithSkipRetry())
}
