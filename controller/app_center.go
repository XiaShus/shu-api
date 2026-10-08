package controller

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// App-center routes reuse the playground session so a logged-in dashboard user
// can call image, video, speech, and Midjourney without a stored API token.
// Keeping the handlers in this file leaves controller/playground.go unchanged.

func PlaygroundImage(c *gin.Context) {
	if newAPIError := setupAppCenterSession(c); newAPIError != nil {
		c.JSON(newAPIError.StatusCode, gin.H{
			"error": newAPIError.ToOpenAIError(),
		})
		return
	}
	RelayTaskPluginEndpoint(c, func(c *gin.Context) {
		Relay(c, types.RelayFormatOpenAIImage)
	})
}

func PlaygroundVideo(c *gin.Context) {
	if newAPIError := setupAppCenterSession(c); newAPIError != nil {
		c.JSON(newAPIError.StatusCode, gin.H{
			"error": newAPIError.ToOpenAIError(),
		})
		return
	}
	RelayTaskPluginEndpoint(c, RelayTask)
}

func PlaygroundVideoFetch(c *gin.Context) {
	if newAPIError := setupAppCenterSession(c); newAPIError != nil {
		c.JSON(newAPIError.StatusCode, gin.H{
			"error": newAPIError.ToOpenAIError(),
		})
		return
	}
	// RelayTaskFetch serves the OpenAI video body only when the path is /v1/videos/.
	if taskID := c.Param("task_id"); taskID != "" {
		c.Request.URL.Path = "/v1/videos/" + taskID
		c.Request.RequestURI = c.Request.URL.RequestURI()
	}
	RelayTaskFetch(c)
}

func PlaygroundVideoContent(c *gin.Context) {
	if newAPIError := setupAppCenterSession(c); newAPIError != nil {
		c.JSON(newAPIError.StatusCode, gin.H{
			"error": newAPIError.ToOpenAIError(),
		})
		return
	}
	VideoProxy(c)
}

func PlaygroundSpeech(c *gin.Context) {
	if newAPIError := setupAppCenterSession(c); newAPIError != nil {
		c.JSON(newAPIError.StatusCode, gin.H{
			"error": newAPIError.ToOpenAIError(),
		})
		return
	}
	Relay(c, types.RelayFormatOpenAIAudio)
}

func PlaygroundMidjourney(c *gin.Context) {
	if c.GetBool("use_access_token") {
		c.JSON(http.StatusForbidden, gin.H{
			"description": "access token is not supported",
			"type":        "upstream_error",
			"code":        4,
		})
		return
	}

	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"description": err.Error(),
			"type":        "upstream_error",
			"code":        4,
		})
		return
	}
	userCache.WriteContext(c)

	group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-mj-%s", group),
		Group:  group,
	}
	if err = middleware.SetupContextForToken(c, tempToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"description": err.Error(),
			"type":        "upstream_error",
			"code":        4,
		})
		return
	}

	RelayMidjourney(c)
}

func setupAppCenterSession(c *gin.Context) *types.NewAPIError {
	if c.GetBool("use_access_token") {
		return types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}
