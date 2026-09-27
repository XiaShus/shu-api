package router

import (
	"embed"
	"net/http"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard frontend assets.
type WebAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

func SetWebRouter(router *gin.Engine, assets WebAssets, pluginDispatcher gin.HandlerFunc) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")
	// Hashed bundles must not share the document rate-limit budget. A Redis
	// error on that limiter is HTTP 500, and 120 requests / 180s is easy to
	// spend on lazy chunks; either one makes the dashboard error page render.
	webRateLimit := middleware.GlobalWebRateLimit()

	router.NoRoute(
		pluginDispatcher,
		middleware.RouteTag("web"),
		gzip.Gzip(gzip.DefaultCompression),
		middleware.AccessTokenAudit(),
		middleware.Cache(),
		func(c *gin.Context) {
			if isEmbeddedStaticAsset(c.Request.URL.Path) {
				c.Next()
				return
			}
			webRateLimit(c)
		},
		static.Serve("/", frontendFS),
		func(c *gin.Context) {
			if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
				controller.RelayNotFound(c)
				return
			}
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
		},
	)
}

// isEmbeddedStaticAsset reports dashboard files whose names are content-hashed
// or otherwise safe to serve without the per-IP web limiter.
func isEmbeddedStaticAsset(requestPath string) bool {
	cleaned := path.Clean("/" + strings.TrimPrefix(requestPath, "/"))
	return cleaned == "/favicon.ico" || strings.HasPrefix(cleaned, "/static/")
}
