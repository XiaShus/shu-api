package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

type CanvasDraft struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	UserId    int    `json:"user_id" gorm:"uniqueIndex"`
	Body      string `json:"body" gorm:"type:text"`
	UpdatedAt int64  `json:"updated_at"`
}

func GetCanvasDraftByUserId(userId int) (*CanvasDraft, error) {
	var draft CanvasDraft
	err := DB.Where("user_id = ?", userId).First(&draft).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &draft, nil
}

func SaveCanvasDraft(userId int, body string) error {
	now := time.Now().Unix()
	var draft CanvasDraft
	err := DB.Where("user_id = ?", userId).First(&draft).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return DB.Create(&CanvasDraft{
			UserId:    userId,
			Body:      body,
			UpdatedAt: now,
		}).Error
	}
	if err != nil {
		return err
	}
	draft.Body = body
	draft.UpdatedAt = now
	return DB.Model(&draft).Select("body", "updated_at").Updates(&draft).Error
}
