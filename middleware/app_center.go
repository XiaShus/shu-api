package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// recognizeAppCenterRequest handles fork /pg image, video, and speech paths
// before the upstream path switch. Chat completions stay on the upstream path.
func recognizeAppCenterRequest(c *gin.Context) (bool, bool, *ModelRequest, error) {
	path := c.Request.URL.Path
	var modelRequest ModelRequest
	if modelName := c.GetString("resolved_task_model"); modelName != "" {
		modelRequest.Model = modelName
	}

	switch {
	case strings.HasPrefix(path, "/pg/images/generations"):
		c.Set("relay_mode", relayconstant.RelayModeImagesGenerations)
		if err := fillAppCenterModel(c, &modelRequest); err != nil {
			return true, false, nil, err
		}
		modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "dall-e")
		return true, true, &modelRequest, nil
	case strings.HasPrefix(path, "/pg/videos"):
		if c.Request.Method == http.MethodPost {
			c.Set("relay_mode", relayconstant.RelayModeVideoSubmit)
			if err := fillAppCenterModel(c, &modelRequest); err != nil {
				return true, false, nil, err
			}
			return true, true, &modelRequest, nil
		}
		c.Set("relay_mode", relayconstant.RelayModeVideoFetchByID)
		modelRequest.Model = getTaskOriginModelName(c)
		return true, false, &modelRequest, nil
	case strings.HasPrefix(path, "/pg/audio/speech"):
		c.Set("relay_mode", relayconstant.RelayModeAudioSpeech)
		if err := fillAppCenterModel(c, &modelRequest); err != nil {
			return true, false, nil, err
		}
		modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "tts-1")
		return true, true, &modelRequest, nil
	default:
		return false, false, nil, nil
	}
}

func fillAppCenterModel(c *gin.Context, modelRequest *ModelRequest) error {
	req, err := getModelFromRequest(c)
	if err != nil {
		return err
	}
	if req == nil {
		return nil
	}
	modelRequest.Model = req.Model
	modelRequest.Group = req.Group
	if req.Group != "" {
		common.SetContextKey(c, constant.ContextKeyTokenGroup, req.Group)
	}
	return nil
}

func appCenterJSONGroupPath(c *gin.Context) bool {
	if c.Request.Method != http.MethodPost {
		return false
	}
	path := c.Request.URL.Path
	if strings.HasPrefix(path, "/pg/mj/") {
		return false
	}
	return strings.HasPrefix(path, "/pg/chat/completions") ||
		strings.HasPrefix(path, "/pg/images/generations") ||
		path == "/pg/videos" ||
		strings.HasPrefix(path, "/pg/audio/speech")
}

const (
	appCenterOriginalPathKey = "app_center_original_path"
	appCenterOriginalURIKey  = "app_center_original_request_uri"
)

func appCenterV1Path(method, path string) (string, bool) {
	if method != http.MethodPost {
		return "", false
	}
	if strings.HasPrefix(path, "/pg/images/generations") {
		return "/v1" + strings.TrimPrefix(path, "/pg"), true
	}
	if path == "/pg/videos" {
		return "/v1/videos", true
	}
	return "", false
}

// SwapAppCenterPathToV1 makes plugin lookup see the /v1 protocol path.
// RestoreAppCenterPath puts /pg back before channel selection so playground billing still applies.
func SwapAppCenterPathToV1() gin.HandlerFunc {
	return func(c *gin.Context) {
		next, ok := appCenterV1Path(c.Request.Method, c.Request.URL.Path)
		if !ok {
			c.Next()
			return
		}
		c.Set(appCenterOriginalPathKey, c.Request.URL.Path)
		c.Set(appCenterOriginalURIKey, c.Request.RequestURI)
		c.Request.URL.Path = next
		if raw := c.Request.URL.RawQuery; raw != "" {
			c.Request.RequestURI = next + "?" + raw
		} else {
			c.Request.RequestURI = next
		}
		c.Next()
	}
}

func RestoreAppCenterPath() gin.HandlerFunc {
	return func(c *gin.Context) {
		if path, ok := c.Get(appCenterOriginalPathKey); ok {
			if original, isString := path.(string); isString && original != "" {
				c.Request.URL.Path = original
			}
		}
		if uri, ok := c.Get(appCenterOriginalURIKey); ok {
			if original, isString := uri.(string); isString && original != "" {
				c.Request.RequestURI = original
			}
		}
		c.Next()
	}
}

// applyAppCenterMjGroup reads ?group= for dashboard Midjourney calls.
// It returns true when the request was rejected.
func applyAppCenterMjGroup(c *gin.Context) bool {
	if !strings.HasPrefix(c.Request.URL.Path, "/pg/mj/") {
		return false
	}
	requested := strings.TrimSpace(c.Query("group"))
	if requested == "" {
		return false
	}
	usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	if !service.GroupInUserUsableGroups(usingGroup, requested) && requested != usingGroup {
		abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorGroupAccessDenied))
		return true
	}
	common.SetContextKey(c, constant.ContextKeyUsingGroup, requested)
	return false
}
