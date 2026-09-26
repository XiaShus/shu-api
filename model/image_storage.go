package model

import (
	"github.com/QuantumNous/new-api/common"
)

const (
	ImageStorageStatusEnabled  = 1
	ImageStorageStatusDisabled = 2
	ImageStorageSystemOwnerID  = 0
)

type ImageStorage struct {
	Id            int    `json:"id"`
	UserId        int    `json:"user_id" gorm:"index"`
	Name          string `json:"name" gorm:"type:varchar(64)"`
	CdnKey        string `json:"cdn_key" gorm:"type:varchar(40);uniqueIndex"`
	Provider      string `json:"provider" gorm:"type:varchar(16)"`
	Endpoint      string `json:"endpoint" gorm:"type:varchar(255)"`
	Region        string `json:"region" gorm:"type:varchar(64)"`
	Bucket        string `json:"bucket" gorm:"type:varchar(128)"`
	AccessKey     string `json:"access_key" gorm:"type:varchar(255)"`
	SecretKey     string `json:"-" gorm:"type:varchar(512)"`
	Prefix        string `json:"prefix" gorm:"type:varchar(128)"`
	PublicBaseUrl string `json:"public_base_url" gorm:"type:varchar(255)"`
	PathStyle     bool   `json:"path_style"`
	Status        int    `json:"status" gorm:"default:1"`
	LastError     string `json:"last_error" gorm:"type:text"`
	LastErrorAt   int64  `json:"last_error_at"`
	LastSuccessAt int64  `json:"last_success_at"`
	CreatedTime   int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime   int64  `json:"updated_time" gorm:"bigint"`
}

func GenerateImageStorageCdnKey() (string, error) {
	s, err := common.GenerateRandomCharsKey(24)
	if err != nil {
		return "", err
	}
	return "cdn_" + s, nil
}

func GetImageStoragesByOwner(ownerId int) ([]*ImageStorage, error) {
	var items []*ImageStorage
	err := DB.Where("user_id = ?", ownerId).Order("id desc").Find(&items).Error
	return items, err
}

func GetImageStorageByIdAndOwner(id, ownerId int) (*ImageStorage, error) {
	var item ImageStorage
	err := DB.Where("id = ? AND user_id = ?", id, ownerId).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func GetImageStorageByCdnKey(cdnKey string) (*ImageStorage, error) {
	var item ImageStorage
	err := DB.Where("cdn_key = ?", cdnKey).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func GetImageStorageById(id int) (*ImageStorage, error) {
	var item ImageStorage
	err := DB.Where("id = ?", id).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func CountImageStoragesByOwner(ownerId int) (int64, error) {
	var count int64
	err := DB.Model(&ImageStorage{}).Where("user_id = ?", ownerId).Count(&count).Error
	return count, err
}

func (s *ImageStorage) Insert() error {
	return DB.Create(s).Error
}

func (s *ImageStorage) Update() error {
	return DB.Model(s).Select(
		"name", "endpoint", "region", "bucket", "access_key", "secret_key",
		"prefix", "public_base_url", "path_style", "status", "updated_time",
	).Updates(s).Error
}

func (s *ImageStorage) Delete() error {
	return DB.Delete(s).Error
}

func (s *ImageStorage) UpdateCdnKey() error {
	return DB.Model(s).Select("cdn_key", "updated_time").Updates(s).Error
}

func MarkImageStorageResult(id int, errMsg string) error {
	now := common.GetTimestamp()
	updates := map[string]any{
		"updated_time": now,
	}
	if errMsg == "" {
		updates["last_success_at"] = now
		updates["last_error"] = ""
	} else {
		updates["last_error"] = errMsg
		updates["last_error_at"] = now
	}
	return DB.Model(&ImageStorage{}).Where("id = ?", id).Updates(updates).Error
}
