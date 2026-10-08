package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type canvasViewport struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Zoom float64 `json:"zoom"`
}

type canvasNode struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Position map[string]any `json:"position"`
	Data     map[string]any `json:"data"`
}

type canvasEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

type canvasDraftDocument struct {
	Version  int             `json:"version"`
	Nodes    []canvasNode    `json:"nodes"`
	Edges    []canvasEdge    `json:"edges"`
	Viewport *canvasViewport `json:"viewport"`
}

func GetCanvasDraft(c *gin.Context) {
	userId := c.GetInt("id")
	draft, err := model.GetCanvasDraftByUserId(userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	if draft == nil || draft.Body == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    nil,
		})
		return
	}
	var document canvasDraftDocument
	if err = common.UnmarshalJsonStr(draft.Body, &document); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    nil,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    document,
	})
}

func PutCanvasDraft(c *gin.Context) {
	var document canvasDraftDocument
	if err := common.DecodeJson(c.Request.Body, &document); err != nil || !validCanvasDraft(document) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid canvas draft",
		})
		return
	}
	if document.Viewport == nil {
		document.Viewport = &canvasViewport{X: 0, Y: 0, Zoom: 1}
	}
	if document.Nodes == nil {
		document.Nodes = []canvasNode{}
	}
	if document.Edges == nil {
		document.Edges = []canvasEdge{}
	}
	body, err := common.Marshal(document)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	if err = model.SaveCanvasDraft(c.GetInt("id"), string(body)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
	})
}

func validCanvasDraft(document canvasDraftDocument) bool {
	if document.Version != 1 {
		return false
	}
	for _, node := range document.Nodes {
		if node.ID == "" || (node.Type != "text" && node.Type != "image") {
			return false
		}
		if node.Position == nil {
			return false
		}
	}
	for _, edge := range document.Edges {
		if edge.ID == "" || edge.Source == "" || edge.Target == "" {
			return false
		}
	}
	return true
}
