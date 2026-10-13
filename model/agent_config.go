package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

type AgentConfig struct {
	Id        int      `json:"id" gorm:"primaryKey"`
	Kind      string   `json:"kind" gorm:"size:32;index"`
	Name      string   `json:"name" gorm:"size:200"`
	Payload   LongText `json:"payload"`
	CreatedAt int64    `json:"created_at"`
	UpdatedAt int64    `json:"updated_at"`
}

func (AgentConfig) TableName() string {
	return "agent_configs"
}

func ListAgentConfigs(kind string) ([]AgentConfig, error) {
	query := DB.Model(&AgentConfig{})
	if kind != "" {
		query = query.Where("kind = ?", kind)
	}
	var rows []AgentConfig
	err := query.Order("updated_at desc").Find(&rows).Error
	return rows, err
}

func CreateAgentConfig(row *AgentConfig) error {
	now := time.Now().Unix()
	row.CreatedAt = now
	row.UpdatedAt = now
	return DB.Create(row).Error
}

func UpdateAgentConfig(id int, name string, payload string) error {
	var row AgentConfig
	err := DB.First(&row, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return gorm.ErrRecordNotFound
	}
	if err != nil {
		return err
	}
	row.Name = name
	row.Payload = LongText(payload)
	row.UpdatedAt = time.Now().Unix()
	return DB.Model(&row).Select("name", "payload", "updated_at").Updates(&row).Error
}

func DeleteAgentConfig(id int) error {
	result := DB.Delete(&AgentConfig{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
