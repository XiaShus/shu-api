package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

var mjSpeedModes = []string{setting.MjModeFast, setting.MjModeRelax, setting.MjModeTurbo, setting.MjModeDraft}

func NormalizeMjMode(raw string) string {
	mode := strings.ToLower(strings.TrimSpace(raw))
	mode = strings.TrimPrefix(mode, "mj-")
	mode = strings.TrimPrefix(mode, "mj_")
	switch mode {
	case setting.MjModeFast, setting.MjModeRelax, setting.MjModeTurbo, setting.MjModeDraft:
		return mode
	default:
		return ""
	}
}

func promptContainsFlag(prompt, flag string) bool {
	return strings.Contains(" "+strings.ToLower(prompt)+" ", " "+flag+" ")
}

func firstAccountFilterMode(req *dto.MidjourneyRequest) string {
	if req == nil || req.AccountFilter == nil {
		return ""
	}
	for _, item := range req.AccountFilter.Modes {
		if mode := NormalizeMjMode(item); mode == setting.MjModeFast || mode == setting.MjModeRelax || mode == setting.MjModeTurbo {
			return mode
		}
	}
	return ""
}

func modeFromPromptFlags(prompt string) string {
	switch {
	case promptContainsFlag(prompt, "--fast"):
		return setting.MjModeFast
	case promptContainsFlag(prompt, "--relax"):
		return setting.MjModeRelax
	case promptContainsFlag(prompt, "--turbo"):
		return setting.MjModeTurbo
	default:
		return ""
	}
}

func InferMjModeFromPrompt(prompt string) string {
	if promptContainsFlag(prompt, "--draft") {
		return setting.MjModeDraft
	}
	return modeFromPromptFlags(prompt)
}

func CheckMjModeAllowed(group, mode string) error {
	rule, ok := setting.GetMjGroupModePolicy(group)
	if !ok || len(rule.Allowed) == 0 {
		return nil
	}
	for _, item := range rule.Allowed {
		if NormalizeMjMode(item) == mode {
			return nil
		}
	}
	return fmt.Errorf("midjourney mode %s is not allowed for group %s, allowed: %v", mode, group, rule.Allowed)
}

func ResolveMjMode(c *gin.Context, req *dto.MidjourneyRequest) (mode string, source string) {
	prompt := ""
	if req != nil {
		prompt = req.Prompt
	}
	if promptContainsFlag(prompt, "--draft") {
		return setting.MjModeDraft, "draft_flag"
	}
	if c != nil {
		if pathMode := modeFromRequestPath(c.Request.URL.Path, c.Param("mode")); pathMode != "" {
			return pathMode, "path"
		}
	}
	if filterMode := firstAccountFilterMode(req); filterMode != "" {
		return filterMode, "account_filter"
	}
	if promptMode := modeFromPromptFlags(prompt); promptMode != "" {
		return promptMode, "prompt_flag"
	}
	group := ""
	if c != nil {
		group = c.GetString("using_group")
		if group == "" {
			group = c.GetString("group")
		}
	}
	if rule, ok := setting.GetMjGroupModePolicy(group); ok {
		if def := NormalizeMjMode(rule.Default); def != "" {
			return def, "group_default"
		}
	}
	return setting.MjModeFast, "default"
}

func modeFromRequestPath(path, param string) string {
	if mode := NormalizeMjMode(param); mode == setting.MjModeFast || mode == setting.MjModeRelax || mode == setting.MjModeTurbo {
		return mode
	}
	lower := strings.ToLower(path)
	for _, item := range []string{setting.MjModeFast, setting.MjModeRelax, setting.MjModeTurbo} {
		if strings.Contains(lower, "/mj-"+item+"/") || strings.Contains(lower, "/"+item+"/mj/") {
			return item
		}
	}
	return ""
}

func MjModePriceKey(mode, action string) string {
	modelName := CovertMjpActionToModelName(action)
	if strings.HasPrefix(modelName, "mj_") {
		return "mj_" + mode + "_" + strings.TrimPrefix(modelName, "mj_")
	}
	return "mj_" + mode + "_" + modelName
}

func ApplyMjModePricing(info *relaycommon.RelayInfo, action string) {
	if info == nil {
		return
	}
	if info.TaskRelayInfo == nil {
		info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	mode := NormalizeMjMode(info.TaskRelayInfo.MjMode)
	if mode == "" {
		mode = setting.MjModeFast
		info.TaskRelayInfo.MjMode = mode
	}
	ratio := setting.GetMjModeRatio(mode)
	info.TaskRelayInfo.MjModeRatio = ratio
	priceKey := MjModePriceKey(mode, action)
	if _, ok := ratio_setting.GetModelPrice(priceKey, false); ok {
		info.OriginModelName = priceKey
		return
	}
	info.OriginModelName = CovertMjpActionToModelName(action)
}

func FinalizeMjModeQuota(info *relaycommon.RelayInfo, priceDataQuota int) (int, *common.QuotaClamp) {
	if info == nil || info.TaskRelayInfo == nil {
		return priceDataQuota, nil
	}
	if strings.HasPrefix(info.OriginModelName, "mj_"+info.TaskRelayInfo.MjMode+"_") {
		return priceDataQuota, nil
	}
	ratio := info.TaskRelayInfo.MjModeRatio
	if ratio <= 0 {
		ratio = 1
	}
	if ratio == 1 {
		return priceDataQuota, nil
	}
	return common.QuotaFromFloatChecked(float64(priceDataQuota) * ratio)
}

func ChargeMjMode(info *relaycommon.RelayInfo, priceData *hosttypes.PriceData) {
	if info == nil || priceData == nil || info.TaskRelayInfo == nil {
		return
	}
	mode := info.TaskRelayInfo.MjMode
	if !strings.HasPrefix(info.OriginModelName, "mj_"+mode+"_") {
		ratio := info.TaskRelayInfo.MjModeRatio
		if ratio <= 0 {
			ratio = 1
		}
		priceData.AddOtherRatio("mj_mode", ratio)
		quota, clamp := common.QuotaFromFloatChecked(float64(priceData.Quota) * ratio)
		priceData.Quota = quota
		if clamp != nil {
			info.QuotaClamp = clamp
		}
	}
	if !info.TaskRelayInfo.MjHd {
		return
	}
	hdRatio := info.TaskRelayInfo.MjHdRatio
	if hdRatio <= 0 {
		hdRatio = setting.GetMjHdRatio()
	}
	if hdRatio <= 0 {
		return
	}
	priceData.AddOtherRatio("mj_hd", hdRatio)
	if hdRatio == 1 {
		return
	}
	quota, clamp := common.QuotaFromFloatChecked(float64(priceData.Quota) * hdRatio)
	priceData.Quota = quota
	if clamp != nil {
		info.QuotaClamp = clamp
	}
}

func requestHasMjHd(req *dto.MidjourneyRequest) bool {
	if req == nil {
		return false
	}
	return promptContainsFlag(req.Prompt, "--hd") || promptContainsFlag(req.Content, "--hd")
}

func BindResolvedMjMode(info *relaycommon.RelayInfo, c *gin.Context, req *dto.MidjourneyRequest) (string, error) {
	if info == nil {
		return "", fmt.Errorf("relay info is nil")
	}
	mode, source := ResolveMjMode(c, req)
	if err := CheckMjModeAllowed(info.UsingGroup, mode); err != nil {
		return "", err
	}
	if info.TaskRelayInfo == nil {
		info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	info.TaskRelayInfo.MjMode = mode
	info.TaskRelayInfo.MjModeSource = source
	info.TaskRelayInfo.MjModeRatio = setting.GetMjModeRatio(mode)
	info.TaskRelayInfo.MjHd = requestHasMjHd(req)
	if info.TaskRelayInfo.MjHd {
		info.TaskRelayInfo.MjHdRatio = setting.GetMjHdRatio()
	}
	return mode, nil
}

func IsMjSpeedMode(mode string) bool {
	mode = NormalizeMjMode(mode)
	for _, item := range mjSpeedModes {
		if item == mode {
			return true
		}
	}
	return false
}

func CovertMjpActionToModelName(mjAction string) string {
	modelName := "mj_" + strings.ToLower(mjAction)
	if mjAction == constant.MjActionSwapFace {
		modelName = "swap_face"
	}
	if mjAction == constant.MjActionSwapVideoFace {
		modelName = "swap_video_face"
	}
	return modelName
}
