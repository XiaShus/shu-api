package service

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDescribeMidjourneyNonJSONBody(t *testing.T) {
	t.Run("json-looking garbage stays unmarshal error", func(t *testing.T) {
		assert.Equal(t, "unmarshal_response_body_failed (status 200)", describeMidjourneyNonJSONBody(http.StatusOK, []byte(`not-json`)))
	})

	t.Run("html title is surfaced", func(t *testing.T) {
		body := []byte(`<!DOCTYPE html><html><head><title>友情提示</title></head><body></body></html>`)
		assert.Equal(t, "upstream_returned_html (status 200): 友情提示", describeMidjourneyNonJSONBody(http.StatusOK, body))
	})

	t.Run("domain whitelist page is explicit", func(t *testing.T) {
		body := []byte(`<!DOCTYPE html><html><title>友情提示</title><ul><li>原因一：您的域名尚未添加至白名单;</li><li>注意：请勿直接使用IP直接访问网站</li></ul></html>`)
		assert.Equal(t,
			"upstream_blocked: 上游返回机房域名白名单拦截页，请把渠道 API 地址改成已加白名单的域名，不要用 IP 访问",
			describeMidjourneyNonJSONBody(http.StatusOK, body),
		)
	})
}

func TestRequestHasMjHd(t *testing.T) {
	assert.False(t, requestHasMjHd(nil))
	assert.False(t, requestHasMjHd(&dto.MidjourneyRequest{Prompt: "Cat --fast"}))
	assert.False(t, requestHasMjHd(&dto.MidjourneyRequest{Prompt: "Cat --hdr"}))
	assert.True(t, requestHasMjHd(&dto.MidjourneyRequest{Prompt: "Cat --hd"}))
	assert.True(t, requestHasMjHd(&dto.MidjourneyRequest{Prompt: "Cat --HD --fast"}))
	assert.True(t, requestHasMjHd(&dto.MidjourneyRequest{Content: "zoom --hd"}))
}

func TestChargeMjModeAppliesHdOnTopOfSpeed(t *testing.T) {
	originalHd := setting.GetMjHdRatio()
	originalMode := setting.MjModeRatio2JSON()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateMjHdRatio(strconv.FormatFloat(originalHd, 'f', -1, 64)))
		require.NoError(t, setting.UpdateMjModeRatioByJSONString(originalMode))
	})
	require.NoError(t, setting.UpdateMjHdRatio("2"))
	require.NoError(t, setting.UpdateMjModeRatioByJSONString(`{"fast":1,"relax":1.5,"turbo":2,"draft":0.5}`))

	t.Run("fast plus hd doubles", func(t *testing.T) {
		info := &relaycommon.RelayInfo{
			OriginModelName: "mj_imagine",
			TaskRelayInfo:   &relaycommon.TaskRelayInfo{MjMode: "fast", MjModeRatio: 1, MjHd: true, MjHdRatio: 2},
		}
		price := hosttypes.PriceData{Quota: 100, ModelPrice: 0.1}
		ChargeMjMode(info, &price)
		assert.Equal(t, 200, price.Quota)
		assert.Equal(t, 2.0, price.OtherRatios()["mj_hd"])
	})

	t.Run("relax plus hd multiplies both", func(t *testing.T) {
		info := &relaycommon.RelayInfo{
			OriginModelName: "mj_imagine",
			TaskRelayInfo:   &relaycommon.TaskRelayInfo{MjMode: "relax", MjModeRatio: 1.5, MjHd: true, MjHdRatio: 2},
		}
		price := hosttypes.PriceData{Quota: 100, ModelPrice: 0.1}
		ChargeMjMode(info, &price)
		assert.Equal(t, 300, price.Quota)
		assert.Equal(t, 1.5, price.OtherRatios()["mj_mode"])
		assert.Equal(t, 2.0, price.OtherRatios()["mj_hd"])
	})

	t.Run("dedicated mode price still applies hd", func(t *testing.T) {
		info := &relaycommon.RelayInfo{
			OriginModelName: "mj_fast_imagine",
			TaskRelayInfo:   &relaycommon.TaskRelayInfo{MjMode: "fast", MjModeRatio: 3, MjHd: true, MjHdRatio: 2},
		}
		price := hosttypes.PriceData{Quota: 100, ModelPrice: 0.2}
		ChargeMjMode(info, &price)
		assert.Equal(t, 200, price.Quota)
		assert.NotContains(t, price.OtherRatios(), "mj_mode")
		assert.Equal(t, 2.0, price.OtherRatios()["mj_hd"])
	})

	t.Run("without hd keeps speed only", func(t *testing.T) {
		info := &relaycommon.RelayInfo{
			OriginModelName: "mj_imagine",
			TaskRelayInfo:   &relaycommon.TaskRelayInfo{MjMode: "turbo", MjModeRatio: 2},
		}
		price := hosttypes.PriceData{Quota: 100, ModelPrice: 0.1}
		ChargeMjMode(info, &price)
		assert.Equal(t, 200, price.Quota)
		assert.NotContains(t, price.OtherRatios(), "mj_hd")
	})
}

func TestBindResolvedMjModeDetectsHdFlag(t *testing.T) {
	originalHd := setting.GetMjHdRatio()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateMjHdRatio(strconv.FormatFloat(originalHd, 'f', -1, 64)))
	})
	require.NoError(t, setting.UpdateMjHdRatio("2.5"))

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/mj/submit/imagine", nil)
	info := &relaycommon.RelayInfo{}
	mode, err := BindResolvedMjMode(info, c, &dto.MidjourneyRequest{Prompt: "Cat --fast --hd"})
	require.NoError(t, err)
	assert.Equal(t, setting.MjModeFast, mode)
	require.NotNil(t, info.TaskRelayInfo)
	assert.True(t, info.TaskRelayInfo.MjHd)
	assert.Equal(t, 2.5, info.TaskRelayInfo.MjHdRatio)
}

func TestFormatMjConsumeLogContentIncludesModeAndHd(t *testing.T) {
	price := hosttypes.PriceData{
		ModelPrice:     0.15,
		GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
	}

	t.Run("fast plus hd", func(t *testing.T) {
		info := &relaycommon.RelayInfo{
			OriginModelName: "mj_imagine",
			TaskRelayInfo:   &relaycommon.TaskRelayInfo{MjMode: "fast", MjModeRatio: 1.5, MjHd: true, MjHdRatio: 2},
		}
		assert.Equal(t,
			"模型固定价格 0.15，分组倍率 1.00，fast倍率 1.50，HD倍率 2.00，操作 IMAGINE，ID abc",
			FormatMjConsumeLogContent(info, price, "操作 IMAGINE", "ID abc"),
		)
	})

	t.Run("dedicated mode price omits speed ratio", func(t *testing.T) {
		info := &relaycommon.RelayInfo{
			OriginModelName: "mj_fast_imagine",
			TaskRelayInfo:   &relaycommon.TaskRelayInfo{MjMode: "fast", MjModeRatio: 3, MjHd: true, MjHdRatio: 2},
		}
		assert.Equal(t,
			"模型固定价格 0.15，分组倍率 1.00，HD倍率 2.00",
			FormatMjConsumeLogContent(info, price),
		)
	})
}

func TestMarshalMidjourneyTaskResponseKeepsUpstreamFields(t *testing.T) {
	origin := &model.Midjourney{
		MjId: "1790435480905028",
		Payload: `{
			"id":"1790435480905028",
			"botType":"MID_JOURNEY",
			"imageUrl":"https://cdn.example/merged.webp",
			"imageUrls":[
				{"url":"https://cdn.example/0.png","thumbnail":"https://cdn.example/0.webp"},
				{"url":"https://cdn.example/1.png","thumbnail":"https://cdn.example/1.webp"}
			],
			"mode":"FAST",
			"width":1024,
			"height":1024,
			"version":"v 7",
			"properties":{"finalPrompt":"Cat --fast","messageHash":"abc","notifyHook":null},
			"videoUrls":null
		}`,
	}
	presented := dto.MidjourneyDto{
		MjId:       origin.MjId,
		Action:     "IMAGINE",
		Prompt:     "Cat",
		ImageUrl:   "http://localhost:3000/mj/image/1790435480905028",
		Mode:       "fast",
		Status:     "SUCCESS",
		Progress:   "100%",
		Properties: &dto.Properties{FinalPrompt: "Cat --fast"},
	}

	body, err := MarshalMidjourneyTaskResponse(origin, presented)
	require.NoError(t, err)
	var got map[string]any
	require.NoError(t, common.Unmarshal(body, &got))
	assert.Equal(t, "http://localhost:3000/mj/image/1790435480905028", got["imageUrl"])
	assert.Equal(t, "fast", got["mode"])
	assert.Equal(t, "MID_JOURNEY", got["botType"])
	assert.Equal(t, "v 7", got["version"])
	assert.Equal(t, float64(1024), got["width"])
	images, ok := got["imageUrls"].([]any)
	require.True(t, ok)
	require.Len(t, images, 2)
	props, ok := got["properties"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "abc", props["messageHash"])
	assert.Equal(t, "Cat --fast", props["finalPrompt"])
}

func TestParseMidjourneyTaskListPreservesRaw(t *testing.T) {
	body := []byte(`[{"id":"1","imageUrls":[{"url":"https://cdn.example/0.png"}],"botType":"MID_JOURNEY"}]`)
	items, raws, err := ParseMidjourneyTaskList(body)
	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Len(t, raws, 1)
	assert.Equal(t, "1", items[0].MjId)
	assert.Contains(t, string(raws[0]), "imageUrls")
	task := &model.Midjourney{}
	RememberMidjourneyUpstream(task, raws[0])
	assert.Contains(t, string(task.Payload), `"botType":"MID_JOURNEY"`)
}

func TestMidjourneyPayloadColumnRoundTrip(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Midjourney{}))
	task := &model.Midjourney{
		UserId:  1,
		MjId:    "mj-1",
		Payload: `{"imageUrls":[{"url":"https://cdn.example/0.png"}]}`,
	}
	require.NoError(t, db.Create(task).Error)
	var got model.Midjourney
	require.NoError(t, db.Where("mj_id = ?", "mj-1").First(&got).Error)
	assert.Contains(t, string(got.Payload), "imageUrls")
}

func TestUpdateMjHdRatioRejectsInvalid(t *testing.T) {
	originalHd := setting.GetMjHdRatio()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateMjHdRatio(strconv.FormatFloat(originalHd, 'f', -1, 64)))
	})
	require.Error(t, setting.UpdateMjHdRatio("0"))
	require.Error(t, setting.UpdateMjHdRatio("-1"))
	require.Error(t, setting.UpdateMjHdRatio("NaN"))
	require.NoError(t, setting.UpdateMjHdRatio("3"))
	assert.Equal(t, 3.0, setting.GetMjHdRatio())
}
