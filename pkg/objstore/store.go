package objstore

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Store interface {
	Put(ctx context.Context, key, mime string, r io.Reader, size int64) (url string, err error)
	Delete(ctx context.Context, key string) error
}

type Config struct {
	Endpoint      string
	Region        string
	Bucket        string
	AccessKey     string
	SecretKey     string
	Prefix        string
	PublicBaseURL string
	PathStyle     bool
	PresignTTL    time.Duration
	HTTPClient    *http.Client
}

func ObjectKey(prefix string, userId int, ext string) string {
	prefix = strings.Trim(prefix, "/")
	if prefix == "" {
		prefix = "images"
	}
	if ext == "" {
		ext = "png"
	}
	now := time.Now().UTC()
	return fmt.Sprintf("%s/%04d/%02d/%02d/%d/%s.%s",
		prefix, now.Year(), int(now.Month()), now.Day(), userId, strings.ReplaceAll(uuid.NewString(), "-", ""), ext)
}

func PublicURL(base, key string) string {
	base = strings.TrimRight(base, "/")
	key = strings.TrimLeft(key, "/")
	if base == "" {
		return key
	}
	return base + "/" + key
}

func ExtFromMIME(mime string) string {
	mime = strings.ToLower(strings.TrimSpace(mime))
	if i := strings.IndexByte(mime, ';'); i >= 0 {
		mime = strings.TrimSpace(mime[:i])
	}
	switch mime {
	case "image/jpeg", "image/jpg":
		return "jpg"
	case "image/webp":
		return "webp"
	case "image/gif":
		return "gif"
	case "image/bmp":
		return "bmp"
	case "image/svg+xml":
		return "svg"
	case "video/mp4":
		return "mp4"
	case "video/webm":
		return "webm"
	case "video/quicktime":
		return "mov"
	case "text/plain":
		return "txt"
	default:
		if strings.HasPrefix(mime, "image/") {
			ext := strings.TrimPrefix(mime, "image/")
			if ext != "" && !strings.ContainsAny(ext, "/+ ") {
				return ext
			}
		}
		return "png"
	}
}
