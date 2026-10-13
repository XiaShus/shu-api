package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func ListEcomTemplates(c *gin.Context) {
	if err := model.EnsureEcomTemplates(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	rows, err := model.ListEcomTemplates(c.Query("category"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if rows == nil {
		rows = []model.EcomTemplate{}
	}
	counts, err := model.EcomTemplateCategoryCounts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": rows, "counts": counts})
}
