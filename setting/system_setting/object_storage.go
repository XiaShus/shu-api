package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type ObjectStorageSetting struct {
	Enabled                    bool `json:"enabled"`
	DefaultStorageId           int  `json:"default_storage_id"`
	ImageRewriteEnabled        bool `json:"image_rewrite_enabled"`
	GeminiNativeRewriteEnabled bool `json:"gemini_native_rewrite_enabled"`
	StrictMode                 bool `json:"strict_mode"`
	MjMediaPersistEnabled      bool `json:"mj_media_persist_enabled"`
	UploadTimeoutSeconds       int  `json:"upload_timeout_seconds"`
	MaxObjectBytes             int  `json:"max_object_bytes"`
	PresignTTLSeconds          int  `json:"presign_ttl_seconds"`
	UserStorageEnabled         bool `json:"user_storage_enabled"`
	UserStorageMaxCount        int  `json:"user_storage_max_count"`
}

var objectStorageSetting = ObjectStorageSetting{
	Enabled:                    false,
	DefaultStorageId:           0,
	ImageRewriteEnabled:        false,
	GeminiNativeRewriteEnabled: false,
	StrictMode:                 false,
	MjMediaPersistEnabled:      false,
	UploadTimeoutSeconds:       30,
	MaxObjectBytes:             52428800,
	PresignTTLSeconds:          3600,
	UserStorageEnabled:         true,
	UserStorageMaxCount:        5,
}

func init() {
	config.GlobalConfig.Register("object_storage", &objectStorageSetting)
}

func GetObjectStorageSetting() *ObjectStorageSetting {
	return &objectStorageSetting
}

func (s *ObjectStorageSetting) UploadTimeout() int {
	if s == nil || s.UploadTimeoutSeconds <= 0 {
		return 30
	}
	return s.UploadTimeoutSeconds
}

func (s *ObjectStorageSetting) MaxBytes() int64 {
	if s == nil || s.MaxObjectBytes <= 0 {
		return 52428800
	}
	return int64(s.MaxObjectBytes)
}

func (s *ObjectStorageSetting) PresignTTL() int {
	if s == nil || s.PresignTTLSeconds <= 0 {
		return 3600
	}
	return s.PresignTTLSeconds
}

func (s *ObjectStorageSetting) MaxUserCount() int {
	if s == nil || s.UserStorageMaxCount <= 0 {
		return 5
	}
	return s.UserStorageMaxCount
}
