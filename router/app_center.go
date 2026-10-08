package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// registerAppCenterRoutes adds the fork experience and Midjourney session routes.
// Image and video creation use the /v1 plugin chain, then restore /pg before Distribute.
func registerAppCenterRoutes(router *gin.Engine, playgroundRouter *gin.RouterGroup) {
	media := router.Group("/pg")
	media.Use(middleware.RouteTag("relay"))
	media.Use(middleware.SystemPerformanceCheck())
	media.Use(middleware.UserAuth())
	media.Use(middleware.SwapAppCenterPathToV1())
	media.Use(middleware.PinTaskPluginEndpoint())
	media.Use(middleware.PrepareTaskPluginEndpoint())
	media.Use(middleware.RestoreAppCenterPath())
	media.Use(middleware.Distribute())
	{
		media.POST("/images/generations", controller.PlaygroundImage)
		media.POST("/videos", controller.PlaygroundVideo)
	}

	playgroundRouter.GET("/videos/:task_id/content", controller.PlaygroundVideoContent)
	playgroundRouter.GET("/videos/:task_id", controller.PlaygroundVideoFetch)
	playgroundRouter.POST("/audio/speech", controller.PlaygroundSpeech)
	playgroundRouter.POST("/mj/*path", controller.PlaygroundMidjourney)
	playgroundRouter.GET("/mj/*path", controller.PlaygroundMidjourney)
}
