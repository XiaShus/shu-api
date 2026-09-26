package helper

import (
	"bytes"
	"io"
	"mime/multipart"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

const ContextKeyCdnKey = "cdn_key"

func ExtractCdnKey(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}
	contentType := c.Request.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "application/json") {
		if key, ok := extractJSONCdnKey(c); ok {
			c.Set(ContextKeyCdnKey, key)
			return key
		}
	}
	if strings.Contains(contentType, "multipart/form-data") {
		if key, ok := extractMultipartCdnKey(c); ok {
			c.Set(ContextKeyCdnKey, key)
			return key
		}
	}
	key := strings.TrimSpace(c.GetHeader("X-CDN-Key"))
	if key != "" {
		c.Set(ContextKeyCdnKey, key)
	}
	return key
}

func extractJSONCdnKey(c *gin.Context) (string, bool) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return "", false
	}
	data, err := storage.Bytes()
	if err != nil {
		return "", false
	}
	var body map[string]common.RawMessage
	if err := common.Unmarshal(data, &body); err != nil {
		return "", false
	}
	raw, ok := body["cdn_key"]
	if !ok {
		return "", false
	}
	var key string
	if err := common.Unmarshal(raw, &key); err != nil {
		key = strings.Trim(string(raw), `"`)
	}
	key = strings.TrimSpace(key)
	delete(body, "cdn_key")
	rewritten, err := common.Marshal(body)
	if err != nil {
		return key, key != ""
	}
	if err := replaceCachedRequestBody(c, rewritten); err != nil {
		return key, key != ""
	}
	return key, true
}

func extractMultipartCdnKey(c *gin.Context) (string, bool) {
	form, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return "", false
	}
	values := form.Value["cdn_key"]
	key := ""
	if len(values) > 0 {
		key = strings.TrimSpace(values[0])
	}
	rewritten, newCT, err := rebuildMultipartWithoutCdnKey(form)
	if err != nil {
		return key, key != ""
	}
	c.Request.Header.Set("Content-Type", newCT)
	if err := replaceCachedRequestBody(c, rewritten); err != nil {
		return key, key != ""
	}
	return key, true
}

func rebuildMultipartWithoutCdnKey(form *multipart.Form) ([]byte, string, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	for name, values := range form.Value {
		if name == "cdn_key" {
			continue
		}
		for _, value := range values {
			if err := writer.WriteField(name, value); err != nil {
				return nil, "", err
			}
		}
	}
	for name, files := range form.File {
		if name == "cdn_key" {
			continue
		}
		for _, fh := range files {
			src, err := fh.Open()
			if err != nil {
				return nil, "", err
			}
			part, err := writer.CreateFormFile(name, fh.Filename)
			if err != nil {
				src.Close()
				return nil, "", err
			}
			_, err = io.Copy(part, src)
			src.Close()
			if err != nil {
				return nil, "", err
			}
		}
	}
	if err := writer.Close(); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), writer.FormDataContentType(), nil
}

func replaceCachedRequestBody(c *gin.Context, data []byte) error {
	if old, exists := c.Get(common.KeyBodyStorage); exists && old != nil {
		if bs, ok := old.(common.BodyStorage); ok {
			_ = bs.Close()
		}
	}
	storage, err := common.CreateBodyStorage(data)
	if err != nil {
		return err
	}
	c.Set(common.KeyBodyStorage, storage)
	c.Set(common.KeyRequestBody, data)
	c.Request.Body = io.NopCloser(storage)
	c.Request.ContentLength = int64(len(data))
	c.Request.Header.Set("Content-Length", strconv.FormatInt(int64(len(data)), 10))
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return err
	}
	return nil
}
