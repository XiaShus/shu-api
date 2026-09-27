package openai

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestConvertImageEditRequestMultipart verifies that ConvertImageRequest
// re-serializes multipart image edit requests with all fields (including
// stream) and the file intact, both when the form was already parsed and when
// it must be re-parsed from the reusable body.
func TestConvertImageEditRequestMultipart(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newMultipartContext := func(t *testing.T, prompt string) *gin.Context {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", prompt))
		require.NoError(t, writer.WriteField("stream", "true"))
		require.NoError(t, writer.WriteField("partial_images", "3"))
		part, err := writer.CreateFormFile("image", "input.png")
		require.NoError(t, err)
		_, err = part.Write([]byte("fake image"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		return c
	}

	convertAndReplay := func(t *testing.T, c *gin.Context, prompt string) {
		info := &relaycommon.RelayInfo{
			RelayMode: relayconstant.RelayModeImagesEdits,
		}
		request := dto.ImageRequest{
			Model:  "gpt-image-1",
			Prompt: prompt,
			Stream: common.GetPointer(true),
		}

		converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
		require.NoError(t, err)
		convertedBody, ok := converted.(*bytes.Buffer)
		require.True(t, ok)

		replayedRequest := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(convertedBody.Bytes()))
		replayedRequest.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
		require.NoError(t, replayedRequest.ParseMultipartForm(32<<20))

		require.Equal(t, "gpt-image-1", replayedRequest.PostForm.Get("model"))
		require.Equal(t, prompt, replayedRequest.PostForm.Get("prompt"))
		require.Equal(t, "true", replayedRequest.PostForm.Get("stream"))
		require.Equal(t, "3", replayedRequest.PostForm.Get("partial_images"))
		require.Len(t, replayedRequest.MultipartForm.File["image"], 1)

		file, err := replayedRequest.MultipartForm.File["image"][0].Open()
		require.NoError(t, err)
		defer file.Close()
		fileBytes, err := io.ReadAll(file)
		require.NoError(t, err)
		require.Equal(t, []byte("fake image"), fileBytes)
	}

	t.Run("with pre-parsed form", func(t *testing.T) {
		prompt := "edit this image"
		c := newMultipartContext(t, prompt)
		require.NoError(t, c.Request.ParseMultipartForm(32<<20))

		convertAndReplay(t, c, prompt)
	})

	t.Run("re-parses reusable body when form is missing", func(t *testing.T) {
		prompt := "edit without pre-parsed form"
		c := newMultipartContext(t, prompt)

		storage, err := common.GetBodyStorage(c)
		require.NoError(t, err)
		c.Request.Body = io.NopCloser(storage)
		c.Request.MultipartForm = nil
		c.Request.PostForm = nil

		convertAndReplay(t, c, prompt)
	})
}

func TestConvertImageEditJSONKeepsImageURL(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := []byte(`{
		"model": "gpt-image-2",
		"prompt": "保持人物主体和背景基本不变，把图片中的美女改成帅哥",
		"size": "1024x1024",
		"images": [{"image_url": "https://oss.example/source.png", "detail": "high"}],
		"response_format": "url",
		"n": 2
	}`)
	var request dto.ImageRequest
	require.NoError(t, common.Unmarshal(body, &request))
	copied, err := common.DeepCopy(&request)
	require.NoError(t, err)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}

	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, *copied)
	require.NoError(t, err)
	outbound, err := common.Marshal(converted)
	require.NoError(t, err)

	var sent map[string]any
	require.NoError(t, common.Unmarshal(outbound, &sent))
	images, ok := sent["images"].([]any)
	require.True(t, ok)
	require.Len(t, images, 1)
	item, ok := images[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "https://oss.example/source.png", item["image_url"])
	require.Equal(t, "high", item["detail"])
	require.Equal(t, "url", sent["response_format"])
	require.EqualValues(t, 2, sent["n"])
}

func TestConvertImageEditJSONAddsImageURLWithoutDroppingImage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := []byte(`{"model":"gpt-image-2","prompt":"edit","image":"https://oss.example/a.png","n":1}`)
	var request dto.ImageRequest
	require.NoError(t, common.Unmarshal(body, &request))
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}

	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	require.NoError(t, err)
	outbound, err := common.Marshal(converted)
	require.NoError(t, err)

	var sent struct {
		Image  string `json:"image"`
		Images []struct {
			ImageURL string `json:"image_url"`
		} `json:"images"`
	}
	require.NoError(t, common.Unmarshal(outbound, &sent))
	require.Equal(t, "https://oss.example/a.png", sent.Image)
	require.Len(t, sent.Images, 1)
	require.Equal(t, "https://oss.example/a.png", sent.Images[0].ImageURL)
}

func TestConvertImageEditJSONAddsImageURLOnExistingImages(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := []byte(`{"model":"gpt-image-2","prompt":"edit","images":[{"url":"https://oss.example/a.png"}],"n":1}`)
	var request dto.ImageRequest
	require.NoError(t, common.Unmarshal(body, &request))
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}

	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	require.NoError(t, err)
	outbound, err := common.Marshal(converted)
	require.NoError(t, err)

	var sent struct {
		Images []struct {
			URL      string `json:"url"`
			ImageURL string `json:"image_url"`
		} `json:"images"`
	}
	require.NoError(t, common.Unmarshal(outbound, &sent))
	require.Len(t, sent.Images, 1)
	require.Equal(t, "https://oss.example/a.png", sent.Images[0].URL)
	require.Equal(t, "https://oss.example/a.png", sent.Images[0].ImageURL)

	stringBody := []byte(`{"model":"gpt-image-2","prompt":"edit","images":["https://oss.example/a.png"],"n":1}`)
	var stringRequest dto.ImageRequest
	require.NoError(t, common.Unmarshal(stringBody, &stringRequest))
	stringConverted, err := (&Adaptor{}).ConvertImageRequest(c, info, stringRequest)
	require.NoError(t, err)
	stringOutbound, err := common.Marshal(stringConverted)
	require.NoError(t, err)
	var stringSent struct {
		Images []struct {
			ImageURL string `json:"image_url"`
		} `json:"images"`
	}
	require.NoError(t, common.Unmarshal(stringOutbound, &stringSent))
	require.Len(t, stringSent.Images, 1)
	require.Equal(t, "https://oss.example/a.png", stringSent.Images[0].ImageURL)
}
