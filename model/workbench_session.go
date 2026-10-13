package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

type WorkbenchSession struct {
	Id        int      `json:"id" gorm:"primaryKey"`
	UserId    int      `json:"user_id" gorm:"index"`
	Kind      string   `json:"kind" gorm:"size:32;index"`
	Title     string   `json:"title" gorm:"size:200"`
	Layout    string   `json:"layout" gorm:"size:32"`
	Payload   LongText `json:"payload"`
	CreatedAt int64    `json:"created_at"`
	UpdatedAt int64    `json:"updated_at"`
}

func (WorkbenchSession) TableName() string {
	return "workbench_sessions"
}

func ListWorkbenchSessions(userId int, kind string) ([]WorkbenchSession, error) {
	query := DB.Where("user_id = ?", userId)
	if kind != "" {
		query = query.Where("kind = ?", kind)
	}
	var rows []WorkbenchSession
	err := query.Order("updated_at desc").Find(&rows).Error
	return rows, err
}

func GetWorkbenchSession(userId int, id int) (*WorkbenchSession, error) {
	var row WorkbenchSession
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func CreateWorkbenchSession(row *WorkbenchSession) error {
	now := time.Now().Unix()
	row.CreatedAt = now
	row.UpdatedAt = now
	return DB.Create(row).Error
}

func UpdateWorkbenchSession(userId int, id int, title string, layout string, payload string) error {
	row, err := GetWorkbenchSession(userId, id)
	if err != nil {
		return err
	}
	if row == nil {
		return gorm.ErrRecordNotFound
	}
	row.Title = title
	row.Layout = layout
	row.Payload = LongText(payload)
	row.UpdatedAt = time.Now().Unix()
	return DB.Model(row).Select("title", "layout", "payload", "updated_at").Updates(row).Error
}

func DeleteWorkbenchSession(userId int, id int) error {
	result := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&WorkbenchSession{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
