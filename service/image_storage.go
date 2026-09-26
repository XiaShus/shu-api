package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/objstore"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relaydto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

type ImageStorageTarget struct {
	Storage *model.ImageStorage
	Source  string
}

var markdownDataURIRe = regexp.MustCompile(`data:(image\/[A-Za-z0-9.+-]+)(?:;charset=[^;,]*)?;base64,([A-Za-z0-9+/=\s]+)`)

func ResolveImageStorageTarget(userId int, cdnKey string) (*ImageStorageTarget, string) {
	cfg := system_setting.GetObjectStorageSetting()
	if cfg == nil || !cfg.Enabled {
		return nil, "disabled"
	}
	cdnKey = strings.TrimSpace(cdnKey)
	if cdnKey != "" {
		item, err := model.GetImageStorageByCdnKey(cdnKey)
		if err != nil || item == nil {
			return nil, "cdn_key_not_found"
		}
		if item.Status != model.ImageStorageStatusEnabled {
			return nil, "cdn_key_disabled"
		}
		if item.UserId != userId && item.UserId != model.ImageStorageSystemOwnerID {
			return nil, "cdn_key_forbidden"
		}
		if item.UserId > 0 && !cfg.UserStorageEnabled {
			return nil, "user_storage_disabled"
		}
		return &ImageStorageTarget{Storage: item, Source: "cdn_key"}, ""
	}
	if !cfg.ImageRewriteEnabled || cfg.DefaultStorageId <= 0 {
		return nil, "no_default"
	}
	item, err := model.GetImageStorageById(cfg.DefaultStorageId)
	if err != nil || item == nil || item.Status != model.ImageStorageStatusEnabled {
		return nil, "default_unavailable"
	}
	return &ImageStorageTarget{Storage: item, Source: "default"}, ""
}

func PersistBase64Image(ctx context.Context, target *ImageStorageTarget, dataURIOrB64 string, userId int) (string, error) {
	if target == nil || target.Storage == nil {
		return "", fmt.Errorf("no storage target")
	}
	mime, payload, err := DecodeBase64FileData(dataURIOrB64)
	if err != nil {
		return "", err
	}
	raw, err := decodeBase64Payload(payload)
	if err != nil {
		return "", err
	}
	return persistBytes(ctx, target, mime, raw, userId)
}

func RewriteOpenAIImageStreamEvent(info *relaycommon.RelayInfo, body []byte) []byte {
	if gjson.GetBytes(body, "data").IsArray() {
		return RewriteOpenAIImageResponse(info, body)
	}
	if len(body) == 0 || !shouldAttemptRewrite(info) {
		return body
	}
	b64 := gjson.GetBytes(body, "b64_json")
	if b64.Type != gjson.String || b64.String() == "" {
		return body
	}
	url, err := persistWithInfo(info, b64.String())
	if err != nil {
		return body
	}
	next, setErr := sjson.SetBytes(body, "url", url)
	if setErr != nil {
		return body
	}
	next, delErr := sjson.DeleteBytes(next, "b64_json")
	if delErr != nil {
		return body
	}
	return next
}

func RewriteOpenAIImageResponse(info *relaycommon.RelayInfo, body []byte) []byte {
	if len(body) == 0 || !shouldAttemptRewrite(info) {
		return body
	}
	n := gjson.GetBytes(body, "data.#").Int()
	for i := range n {
		b64Path := fmt.Sprintf("data.%d.b64_json", i)
		urlPath := fmt.Sprintf("data.%d.url", i)
		b64 := gjson.GetBytes(body, b64Path)
		if b64.Type == gjson.String && b64.String() != "" {
			url, err := persistWithInfo(info, b64.String())
			if err != nil {
				continue
			}
			next, setErr := sjson.SetBytes(body, urlPath, url)
			if setErr != nil {
				continue
			}
			next, delErr := sjson.DeleteBytes(next, b64Path)
			if delErr != nil {
				continue
			}
			body = next
			continue
		}
		origin := strings.TrimSpace(gjson.GetBytes(body, urlPath).String())
		if origin == "" || (!strings.HasPrefix(origin, "http://") && !strings.HasPrefix(origin, "https://")) {
			continue
		}
		url, err := persistRemoteWithInfo(info, origin)
		if err != nil {
			continue
		}
		next, setErr := sjson.SetBytes(body, urlPath, url)
		if setErr != nil {
			continue
		}
		body = next
	}
	return body
}

func RewriteMarkdownDataURIs(info *relaycommon.RelayInfo, text string) string {
	if text == "" || !shouldAttemptRewrite(info) {
		return text
	}
	return markdownDataURIRe.ReplaceAllStringFunc(text, func(match string) string {
		url, err := persistWithInfo(info, match)
		if err != nil {
			return match
		}
		return url
	})
}

func RewriteOpenAIChatContent(info *relaycommon.RelayInfo, body []byte) []byte {
	if len(body) == 0 || !shouldAttemptRewrite(info) {
		return body
	}
	n := gjson.GetBytes(body, "choices.#").Int()
	for i := range n {
		path := fmt.Sprintf("choices.%d.message.content", i)
		content := gjson.GetBytes(body, path)
		if content.Type != gjson.String {
			continue
		}
		rewritten := RewriteMarkdownDataURIs(info, content.String())
		if rewritten == content.String() {
			continue
		}
		next, err := sjson.SetBytes(body, path, rewritten)
		if err != nil {
			continue
		}
		body = next
	}
	return body
}

func RewriteResponsesOutput(info *relaycommon.RelayInfo, body []byte) []byte {
	if len(body) == 0 || !shouldAttemptRewrite(info) {
		return body
	}
	n := gjson.GetBytes(body, "output.#").Int()
	for i := range n {
		typ := gjson.GetBytes(body, fmt.Sprintf("output.%d.type", i)).String()
		if typ != relaydto.ResponsesOutputTypeImageGenerationCall {
			continue
		}
		body = rewriteBase64Field(info, body, fmt.Sprintf("output.%d.result", i))
	}
	if gjson.GetBytes(body, "item.type").String() == relaydto.ResponsesOutputTypeImageGenerationCall {
		body = rewriteBase64Field(info, body, "item.result")
	}
	return body
}

func RewriteGeminiNativeInlineData(info *relaycommon.RelayInfo, body []byte) []byte {
	cfg := system_setting.GetObjectStorageSetting()
	if cfg == nil || !cfg.GeminiNativeRewriteEnabled || len(body) == 0 || !shouldAttemptRewrite(info) {
		return body
	}
	var resp relaydto.GeminiChatResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return body
	}
	changed := false
	for i := range resp.Candidates {
		for j := range resp.Candidates[i].Content.Parts {
			part := &resp.Candidates[i].Content.Parts[j]
			if part.InlineData == nil || part.InlineData.Data == "" {
				continue
			}
			dataURI := part.InlineData.Data
			if part.InlineData.MimeType != "" && !strings.HasPrefix(dataURI, "data:") {
				dataURI = "data:" + part.InlineData.MimeType + ";base64," + dataURI
			}
			url, err := persistWithInfo(info, dataURI)
			if err != nil {
				continue
			}
			mime := part.InlineData.MimeType
			part.InlineData = nil
			part.FileData = &relaydto.GeminiFileData{MimeType: mime, FileUri: url}
			changed = true
		}
	}
	if !changed {
		return body
	}
	out, err := common.Marshal(resp)
	if err != nil {
		return body
	}
	return out
}

func RewriteGeminiChatInlineParts(info *relaycommon.RelayInfo, resp *relaydto.GeminiChatResponse) {
	if resp == nil || !shouldAttemptRewrite(info) {
		return
	}
	for i := range resp.Candidates {
		for j := range resp.Candidates[i].Content.Parts {
			part := &resp.Candidates[i].Content.Parts[j]
			if part.InlineData == nil || part.InlineData.Data == "" {
				continue
			}
			dataURI := part.InlineData.Data
			if part.InlineData.MimeType != "" && !strings.HasPrefix(dataURI, "data:") {
				dataURI = "data:" + part.InlineData.MimeType + ";base64," + dataURI
			}
			url, err := persistWithInfo(info, dataURI)
			if err != nil {
				continue
			}
			part.Text = "![image](" + url + ")"
			part.InlineData = nil
		}
	}
}

func PersistMidjourneyMedia(task *model.Midjourney) {
	if task == nil || task.Status != "SUCCESS" {
		return
	}
	cfg := system_setting.GetObjectStorageSetting()
	if cfg == nil || !cfg.Enabled || !cfg.MjMediaPersistEnabled || cfg.DefaultStorageId <= 0 {
		return
	}
	item, err := model.GetImageStorageById(cfg.DefaultStorageId)
	if err != nil || item == nil || item.Status != model.ImageStorageStatusEnabled {
		return
	}
	target := &ImageStorageTarget{Storage: item, Source: "default"}
	ctx := context.Background()

	newImage := task.ImageUrl
	if task.ImageUrl != "" {
		url, persistErr := persistRemoteURL(ctx, target, task.ImageUrl, task.UserId)
		if persistErr != nil {
			common.SysError("mj media persist image failed: " + persistErr.Error())
			return
		}
		newImage = url
	}
	newVideo := task.VideoUrl
	if task.VideoUrl != "" {
		url, persistErr := persistRemoteURL(ctx, target, task.VideoUrl, task.UserId)
		if persistErr != nil {
			common.SysError("mj media persist video failed: " + persistErr.Error())
			return
		}
		newVideo = url
	}
	newVideoUrls := task.VideoUrls
	if task.VideoUrls != "" {
		var items []dto.ImgUrls
		if unmarshalErr := common.UnmarshalJsonStr(task.VideoUrls, &items); unmarshalErr != nil {
			common.SysError("mj media persist video_urls decode failed: " + unmarshalErr.Error())
			return
		}
		for i := range items {
			if items[i].Url == "" {
				continue
			}
			url, persistErr := persistRemoteURL(ctx, target, items[i].Url, task.UserId)
			if persistErr != nil {
				common.SysError("mj media persist video_urls failed: " + persistErr.Error())
				return
			}
			items[i].Url = url
		}
		encoded, marshalErr := common.Marshal(items)
		if marshalErr != nil {
			common.SysError("mj media persist video_urls encode failed: " + marshalErr.Error())
			return
		}
		newVideoUrls = string(encoded)
	}

	task.ImageUrl = newImage
	task.VideoUrl = newVideo
	task.VideoUrls = newVideoUrls
	task.MediaStored = true
}

func ImageStorageStrictError(info *relaycommon.RelayInfo) *types.NewAPIError {
	cfg := system_setting.GetObjectStorageSetting()
	if info == nil || info.ImageStorage == nil || cfg == nil || !cfg.StrictMode {
		return nil
	}
	if info.ImageStorage.Source != "default" || !info.ImageStorage.Fallback {
		return nil
	}
	return types.NewErrorWithStatusCode(fmt.Errorf("image storage persist failed"), types.ErrorCodeBadResponseBody, http.StatusBadGateway, types.ErrOptionWithSkipRetry())
}

func NewS3StoreFromModel(item *model.ImageStorage) (objstore.Store, error) {
	if item == nil {
		return nil, fmt.Errorf("empty storage")
	}
	cfg := system_setting.GetObjectStorageSetting()
	httpClient := GetHttpClient()
	if item.UserId > 0 {
		httpClient = GetSSRFProtectedHTTPClient()
	}
	return objstore.NewS3Store(objstore.Config{
		Endpoint:      item.Endpoint,
		Region:        item.Region,
		Bucket:        item.Bucket,
		AccessKey:     item.AccessKey,
		SecretKey:     item.SecretKey,
		Prefix:        item.Prefix,
		PublicBaseURL: item.PublicBaseUrl,
		PathStyle:     item.PathStyle,
		PresignTTL:    time.Duration(cfg.PresignTTL()) * time.Second,
		HTTPClient:    httpClient,
	})
}

func shouldAttemptRewrite(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	cfg := system_setting.GetObjectStorageSetting()
	if cfg == nil || !cfg.Enabled {
		return false
	}
	if strings.TrimSpace(info.CdnKey) != "" {
		return true
	}
	return cfg.ImageRewriteEnabled && cfg.DefaultStorageId > 0
}

func persistWithInfo(info *relaycommon.RelayInfo, dataURIOrB64 string) (string, error) {
	target, reason := ResolveImageStorageTarget(info.UserId, info.CdnKey)
	if target == nil {
		recordImageStorageMiss(info, reason)
		return "", fmt.Errorf("%s", reason)
	}
	ensureImageStorageInfo(info, target, "")
	url, err := PersistBase64Image(context.Background(), target, dataURIOrB64, info.UserId)
	if err != nil {
		common.SysError("image storage persist failed: " + err.Error())
		markImageStorageFallback(info, err.Error())
		return "", err
	}
	if info.ImageStorage != nil {
		info.ImageStorage.Persisted++
	}
	return url, nil
}

func persistRemoteWithInfo(info *relaycommon.RelayInfo, originURL string) (string, error) {
	target, reason := ResolveImageStorageTarget(info.UserId, info.CdnKey)
	if target == nil {
		recordImageStorageMiss(info, reason)
		return "", fmt.Errorf("%s", reason)
	}
	ensureImageStorageInfo(info, target, "")
	url, err := persistRemoteURL(context.Background(), target, originURL, info.UserId)
	if err != nil {
		common.SysError("image storage persist remote failed: " + err.Error())
		markImageStorageFallback(info, err.Error())
		return "", err
	}
	if info.ImageStorage != nil {
		info.ImageStorage.Persisted++
	}
	return url, nil
}

func rewriteBase64Field(info *relaycommon.RelayInfo, body []byte, path string) []byte {
	result := gjson.GetBytes(body, path)
	if result.Type != gjson.String || result.String() == "" {
		return body
	}
	value := result.String()
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		return body
	}
	url, err := persistWithInfo(info, value)
	if err != nil {
		return body
	}
	next, setErr := sjson.SetBytes(body, path, url)
	if setErr != nil {
		return body
	}
	return next
}

func persistBytes(ctx context.Context, target *ImageStorageTarget, mime string, data []byte, userId int) (string, error) {
	cfg := system_setting.GetObjectStorageSetting()
	if int64(len(data)) > cfg.MaxBytes() {
		err := fmt.Errorf("object exceeds max_object_bytes: %d", len(data))
		_ = model.MarkImageStorageResult(target.Storage.Id, err.Error())
		return "", err
	}
	if target.Storage.UserId > 0 && !strings.HasPrefix(strings.ToLower(target.Storage.Endpoint), "https://") {
		err := fmt.Errorf("user storage endpoint must be https")
		_ = model.MarkImageStorageResult(target.Storage.Id, err.Error())
		return "", err
	}
	store, err := NewS3StoreFromModel(target.Storage)
	if err != nil {
		_ = model.MarkImageStorageResult(target.Storage.Id, err.Error())
		return "", err
	}
	timeout := time.Duration(cfg.UploadTimeout()) * time.Second
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	prefix := target.Storage.Prefix
	key := objstore.ObjectKey(prefix, userId, objstore.ExtFromMIME(mime))
	url, err := store.Put(ctx, key, mime, bytes.NewReader(data), int64(len(data)))
	if err != nil {
		_ = model.MarkImageStorageResult(target.Storage.Id, err.Error())
		return "", err
	}
	_ = model.MarkImageStorageResult(target.Storage.Id, "")
	return url, nil
}

func persistRemoteURL(ctx context.Context, target *ImageStorageTarget, originURL string, userId int) (string, error) {
	resp, err := DoDownloadRequest(originURL, "image storage persist")
	if err != nil {
		_ = model.MarkImageStorageResult(target.Storage.Id, err.Error())
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("download status %d", resp.StatusCode)
		_ = model.MarkImageStorageResult(target.Storage.Id, err.Error())
		return "", err
	}
	cfg := system_setting.GetObjectStorageSetting()
	limited := io.LimitReader(resp.Body, cfg.MaxBytes()+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		_ = model.MarkImageStorageResult(target.Storage.Id, err.Error())
		return "", err
	}
	mime := resp.Header.Get("Content-Type")
	return persistBytes(ctx, target, mime, data, userId)
}

func decodeBase64Payload(payload string) ([]byte, error) {
	payload = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r == ' ' {
			return -1
		}
		return r
	}, payload)
	raw, err := base64.StdEncoding.DecodeString(payload)
	if err == nil {
		return raw, nil
	}
	return base64.RawStdEncoding.DecodeString(strings.TrimRight(payload, "="))
}

func ensureImageStorageInfo(info *relaycommon.RelayInfo, target *ImageStorageTarget, reason string) {
	if info == nil {
		return
	}
	if info.ImageStorage == nil {
		info.ImageStorage = &relaycommon.ImageStorageInfo{}
	}
	if target != nil && target.Storage != nil {
		info.ImageStorage.Source = target.Source
		info.ImageStorage.CdnKey = target.Storage.CdnKey
		info.ImageStorage.StorageId = target.Storage.Id
	}
	if reason != "" && info.ImageStorage.Reason == "" {
		info.ImageStorage.Reason = reason
	}
}

func recordImageStorageMiss(info *relaycommon.RelayInfo, reason string) {
	if info == nil {
		return
	}
	if strings.TrimSpace(info.CdnKey) == "" {
		return
	}
	ensureImageStorageInfo(info, nil, reason)
	info.ImageStorage.Source = "cdn_key"
	info.ImageStorage.CdnKey = info.CdnKey
	info.ImageStorage.Fallback = true
}

func markImageStorageFallback(info *relaycommon.RelayInfo, reason string) {
	if info == nil {
		return
	}
	ensureImageStorageInfo(info, nil, reason)
	info.ImageStorage.Fallback = true
	if reason != "" {
		info.ImageStorage.Reason = reason
	}
}
