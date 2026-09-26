package controller

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type imageStorageRequest struct {
	Name          string `json:"name"`
	Provider      string `json:"provider"`
	Endpoint      string `json:"endpoint"`
	Region        string `json:"region"`
	Bucket        string `json:"bucket"`
	AccessKey     string `json:"access_key"`
	SecretKey     string `json:"secret_key"`
	Prefix        string `json:"prefix"`
	PublicBaseUrl string `json:"public_base_url"`
	PathStyle     *bool  `json:"path_style"`
	Status        *int   `json:"status"`
}

type imageStorageView struct {
	model.ImageStorage
	HasSecretKey bool `json:"has_secret_key"`
}

func toImageStorageView(item *model.ImageStorage) imageStorageView {
	view := imageStorageView{ImageStorage: *item}
	view.AccessKey = model.MaskTokenKey(item.AccessKey)
	view.SecretKey = ""
	view.HasSecretKey = strings.TrimSpace(item.SecretKey) != ""
	return view
}

func toImageStorageViews(items []*model.ImageStorage) []imageStorageView {
	views := make([]imageStorageView, 0, len(items))
	for _, item := range items {
		views = append(views, toImageStorageView(item))
	}
	return views
}

func imageStorageOwnerId(c *gin.Context) (int, bool) {
	scope := strings.TrimSpace(c.Query("scope"))
	if scope == "" {
		scope = strings.TrimSpace(c.PostForm("scope"))
	}
	if scope == "system" {
		if c.GetInt("role") < common.RoleRootUser {
			common.ApiErrorMsg(c, http.StatusText(http.StatusForbidden))
			return 0, false
		}
		return model.ImageStorageSystemOwnerID, true
	}
	return c.GetInt("id"), true
}

func GetImageStorages(c *gin.Context) {
	ownerId, ok := imageStorageOwnerId(c)
	if !ok {
		return
	}
	items, err := model.GetImageStoragesByOwner(ownerId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toImageStorageViews(items))
}

func GetImageStorage(c *gin.Context) {
	ownerId, ok := imageStorageOwnerId(c)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.GetImageStorageByIdAndOwner(id, ownerId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgImageStorageNotFound)
		return
	}
	common.ApiSuccess(c, toImageStorageView(item))
}

func AddImageStorage(c *gin.Context) {
	ownerId, ok := imageStorageOwnerId(c)
	if !ok {
		return
	}
	var req imageStorageRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if ownerId > 0 {
		cfg := system_setting.GetObjectStorageSetting()
		if cfg == nil || !cfg.UserStorageEnabled {
			common.ApiErrorI18n(c, i18n.MsgImageStorageUserDisabled)
			return
		}
		count, err := model.CountImageStoragesByOwner(ownerId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(cfg.MaxUserCount()) {
			common.ApiErrorI18n(c, i18n.MsgImageStorageLimitReached)
			return
		}
	}
	item := &model.ImageStorage{
		UserId:        ownerId,
		Name:          strings.TrimSpace(req.Name),
		Provider:      strings.TrimSpace(req.Provider),
		Endpoint:      strings.TrimSpace(req.Endpoint),
		Region:        strings.TrimSpace(req.Region),
		Bucket:        strings.TrimSpace(req.Bucket),
		AccessKey:     strings.TrimSpace(req.AccessKey),
		SecretKey:     req.SecretKey,
		Prefix:        strings.TrimSpace(req.Prefix),
		PublicBaseUrl: strings.TrimSpace(req.PublicBaseUrl),
		PathStyle:     true,
		Status:        model.ImageStorageStatusEnabled,
		CreatedTime:   common.GetTimestamp(),
		UpdatedTime:   common.GetTimestamp(),
	}
	if req.PathStyle != nil {
		item.PathStyle = *req.PathStyle
	}
	if req.Status != nil {
		item.Status = *req.Status
	}
	if err := validateImageStorage(item, true); err != nil {
		if err.Error() == i18n.MsgImageStorageInvalidEndpoint {
			common.ApiErrorI18n(c, i18n.MsgImageStorageInvalidEndpoint)
			return
		}
		common.ApiError(c, err)
		return
	}
	cdnKey, err := model.GenerateImageStorageCdnKey()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	item.CdnKey = cdnKey
	if err := item.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toImageStorageView(item))
}

func UpdateImageStorage(c *gin.Context) {
	ownerId, ok := imageStorageOwnerId(c)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	existing, err := model.GetImageStorageByIdAndOwner(id, ownerId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgImageStorageNotFound)
		return
	}
	var req imageStorageRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	existing.Name = strings.TrimSpace(req.Name)
	if strings.TrimSpace(req.Provider) != "" {
		existing.Provider = strings.TrimSpace(req.Provider)
	}
	existing.Endpoint = strings.TrimSpace(req.Endpoint)
	existing.Region = strings.TrimSpace(req.Region)
	existing.Bucket = strings.TrimSpace(req.Bucket)
	if strings.TrimSpace(req.AccessKey) != "" {
		existing.AccessKey = strings.TrimSpace(req.AccessKey)
	}
	if strings.TrimSpace(req.SecretKey) != "" {
		existing.SecretKey = req.SecretKey
	}
	existing.Prefix = strings.TrimSpace(req.Prefix)
	existing.PublicBaseUrl = strings.TrimSpace(req.PublicBaseUrl)
	if req.PathStyle != nil {
		existing.PathStyle = *req.PathStyle
	}
	if req.Status != nil {
		existing.Status = *req.Status
	}
	existing.UpdatedTime = common.GetTimestamp()
	if err := validateImageStorage(existing, false); err != nil {
		if err.Error() == i18n.MsgImageStorageInvalidEndpoint {
			common.ApiErrorI18n(c, i18n.MsgImageStorageInvalidEndpoint)
			return
		}
		common.ApiError(c, err)
		return
	}
	if err := existing.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toImageStorageView(existing))
}

func DeleteImageStorage(c *gin.Context) {
	ownerId, ok := imageStorageOwnerId(c)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.GetImageStorageByIdAndOwner(id, ownerId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgImageStorageNotFound)
		return
	}
	if err := item.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ResetImageStorageKey(c *gin.Context) {
	ownerId, ok := imageStorageOwnerId(c)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.GetImageStorageByIdAndOwner(id, ownerId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgImageStorageNotFound)
		return
	}
	cdnKey, err := model.GenerateImageStorageCdnKey()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	item.CdnKey = cdnKey
	item.UpdatedTime = common.GetTimestamp()
	if err := item.UpdateCdnKey(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toImageStorageView(item))
}

func TestImageStorage(c *gin.Context) {
	ownerId, ok := imageStorageOwnerId(c)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.GetImageStorageByIdAndOwner(id, ownerId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgImageStorageNotFound)
		return
	}
	store, err := service.NewS3StoreFromModel(item)
	if err != nil {
		_ = model.MarkImageStorageResult(item.Id, err.Error())
		common.ApiErrorI18n(c, i18n.MsgImageStorageTestFailed)
		return
	}
	cfg := system_setting.GetObjectStorageSetting()
	timeout := 15 * time.Second
	if cfg != nil {
		timeout = time.Duration(cfg.UploadTimeout()) * time.Second
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
	defer cancel()
	prefix := strings.Trim(item.Prefix, "/")
	if prefix == "" {
		prefix = "images"
	}
	key := prefix + "/.probe/" + uuid.NewString() + ".txt"
	payload := []byte("1")
	if _, err := store.Put(ctx, key, "text/plain", bytes.NewReader(payload), int64(len(payload))); err != nil {
		_ = model.MarkImageStorageResult(item.Id, err.Error())
		common.ApiErrorI18n(c, i18n.MsgImageStorageTestFailed)
		return
	}
	if err := store.Delete(ctx, key); err != nil {
		_ = model.MarkImageStorageResult(item.Id, err.Error())
		common.ApiErrorI18n(c, i18n.MsgImageStorageTestFailed)
		return
	}
	_ = model.MarkImageStorageResult(item.Id, "")
	common.ApiSuccess(c, gin.H{"ok": true})
}

func validateImageStorage(item *model.ImageStorage, requireSecret bool) error {
	if item.Name == "" || len(item.Name) > 64 {
		return fmt.Errorf("name must be 1-64 characters")
	}
	if item.Provider == "" {
		item.Provider = "s3"
	}
	if item.Bucket == "" {
		return fmt.Errorf("bucket is required")
	}
	if item.AccessKey == "" {
		return fmt.Errorf("access_key is required")
	}
	if requireSecret && strings.TrimSpace(item.SecretKey) == "" {
		return fmt.Errorf("secret_key is required")
	}
	if item.UserId > 0 && !strings.HasPrefix(strings.ToLower(item.Endpoint), "https://") {
		return fmt.Errorf("%s", i18n.MsgImageStorageInvalidEndpoint)
	}
	if item.Status != model.ImageStorageStatusEnabled && item.Status != model.ImageStorageStatusDisabled {
		item.Status = model.ImageStorageStatusEnabled
	}
	return nil
}
