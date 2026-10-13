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

var workbenchKinds = []string{
	"chat", "image", "video", "search", "ppt", "canvas", "kb", "gallery", "ecom", "ide",
}

var workbenchLayouts = []string{"immersive", "three", "arena"}

type workbenchSessionBody struct {
	Kind    string `json:"kind"`
	Title   string `json:"title"`
	Layout  string `json:"layout"`
	Payload string `json:"payload"`
}

func ListWorkbenchSessions(c *gin.Context) {
	kind := c.Query("kind")
	if kind != "" && !slices.Contains(workbenchKinds, kind) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid kind"})
		return
	}
	rows, err := model.ListWorkbenchSessions(c.GetInt("id"), kind)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if rows == nil {
		rows = []model.WorkbenchSession{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": rows})
}

func CreateWorkbenchSession(c *gin.Context) {
	var body workbenchSessionBody
	if err := common.DecodeJson(c.Request.Body, &body); err != nil || !validWorkbenchSession(body, true) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid session"})
		return
	}
	row := &model.WorkbenchSession{
		UserId:  c.GetInt("id"),
		Kind:    body.Kind,
		Title:   body.Title,
		Layout:  body.Layout,
		Payload: model.LongText(body.Payload),
	}
	if err := model.CreateWorkbenchSession(row); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": row})
}

func GetWorkbenchSession(c *gin.Context) {
	id, ok := workbenchID(c)
	if !ok {
		return
	}
	row, err := model.GetWorkbenchSession(c.GetInt("id"), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if row == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "session not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": row})
}

func UpdateWorkbenchSession(c *gin.Context) {
	id, ok := workbenchID(c)
	if !ok {
		return
	}
	var body workbenchSessionBody
	if err := common.DecodeJson(c.Request.Body, &body); err != nil || !validWorkbenchSession(body, false) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid session"})
		return
	}
	err := model.UpdateWorkbenchSession(c.GetInt("id"), id, body.Title, body.Layout, body.Payload)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "session not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteWorkbenchSession(c *gin.Context) {
	id, ok := workbenchID(c)
	if !ok {
		return
	}
	err := model.DeleteWorkbenchSession(c.GetInt("id"), id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "session not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func workbenchID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return 0, false
	}
	return id, true
}

func validWorkbenchSession(body workbenchSessionBody, creating bool) bool {
	if creating && !slices.Contains(workbenchKinds, body.Kind) {
		return false
	}
	if body.Layout != "" && !slices.Contains(workbenchLayouts, body.Layout) {
		return false
	}
	if len(body.Title) > 200 || len(body.Payload) > 200000 {
		return false
	}
	return true
}
