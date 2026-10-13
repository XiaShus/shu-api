package controller

import (
	"errors"
	"net/http"
	"slices"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var agentConfigKinds = []string{"global", "server", "tool", "skill", "run"}

type agentConfigBody struct {
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	Payload string `json:"payload"`
}

func ListAgentConfigs(c *gin.Context) {
	kind := c.Query("kind")
	if kind != "" && !slices.Contains(agentConfigKinds, kind) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid kind"})
		return
	}
	rows, err := model.ListAgentConfigs(kind)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if rows == nil {
		rows = []model.AgentConfig{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": rows})
}

func CreateAgentConfig(c *gin.Context) {
	var body agentConfigBody
	if err := common.DecodeJson(c.Request.Body, &body); err != nil || !validAgentConfig(body, true) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid config"})
		return
	}
	row := &model.AgentConfig{Kind: body.Kind, Name: body.Name, Payload: model.LongText(body.Payload)}
	if err := model.CreateAgentConfig(row); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": row})
}

func UpdateAgentConfig(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var body agentConfigBody
	if err = common.DecodeJson(c.Request.Body, &body); err != nil || !validAgentConfig(body, false) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid config"})
		return
	}
	err = model.UpdateAgentConfig(id, body.Name, body.Payload)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "config not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteAgentConfig(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	err = model.DeleteAgentConfig(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "config not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func validAgentConfig(body agentConfigBody, creating bool) bool {
	if creating && !slices.Contains(agentConfigKinds, body.Kind) {
		return false
	}
	if body.Name == "" || len(body.Name) > 200 || len(body.Payload) > 200000 {
		return false
	}
	return true
}
