package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		// Installed before handlers write, so a later 4xx/5xx can still drop the
		// long freshness. Chrome stores any status that carries an explicit
		// max-age, including 500; a cached chunk error then fails for a week.
		c.Writer = &statusAwareCacheWriter{ResponseWriter: c.Writer}
		if c.Request.RequestURI == "/" {
			c.Header("Cache-Control", "no-cache")
		} else {
			c.Header("Cache-Control", "max-age=604800") // one week
		}
		c.Header("Cache-Version", "b688f2fb5be447c25e5aa3bd063087a83db32a288bf6a4f35f2d8db310e40b14")
		c.Next()
	}
}

// statusAwareCacheWriter removes the static-asset freshness from error
// responses. Handlers that already sent no-store keep their own directive.
type statusAwareCacheWriter struct {
	gin.ResponseWriter
}

func (w *statusAwareCacheWriter) WriteHeader(code int) {
	suppressErrorCache(w.Header(), code)
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusAwareCacheWriter) WriteHeaderNow() {
	suppressErrorCache(w.Header(), w.Status())
	w.ResponseWriter.WriteHeaderNow()
}

func (w *statusAwareCacheWriter) Write(data []byte) (int, error) {
	if !w.Written() {
		status := w.Status()
		if status == 0 {
			status = http.StatusOK
		}
		suppressErrorCache(w.Header(), status)
	}
	return w.ResponseWriter.Write(data)
}

func (w *statusAwareCacheWriter) WriteString(s string) (int, error) {
	return w.Write([]byte(s))
}

func suppressErrorCache(header http.Header, status int) {
	if status < http.StatusBadRequest {
		return
	}
	if strings.Contains(header.Get("Cache-Control"), "no-store") {
		return
	}
	header.Set("Cache-Control", "no-store")
}
