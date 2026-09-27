package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// MaxImageN caps the image generation count. Without this bound a huge or
// wrapped-negative n overflows quota calculation into a negative charge.
const MaxImageN = 128

// ImageBillingParameters contains only the provider scalars parsed by request
// validation. Keep this separate from the complete provider request payload.
type ImageBillingParameters struct {
	N            *uint `json:"n,omitempty"`
	PromptExtend *bool `json:"prompt_extend,omitempty"`
}

type ImageRequest struct {
	Model             string          `json:"model"`
	Prompt            string          `json:"prompt" binding:"required"`
	N                 *uint           `json:"n,omitempty"`
	Size              string          `json:"size,omitempty"`
	Quality           string          `json:"quality,omitempty"`
	ResponseFormat    string          `json:"response_format,omitempty"`
	Style             json.RawMessage `json:"style,omitempty"`
	User              json.RawMessage `json:"user,omitempty"`
	ExtraFields       json.RawMessage `json:"extra_fields,omitempty"`
	Background        json.RawMessage `json:"background,omitempty"`
	Moderation        json.RawMessage `json:"moderation,omitempty"`
	OutputFormat      json.RawMessage `json:"output_format,omitempty"`
	OutputCompression json.RawMessage `json:"output_compression,omitempty"`
	PartialImages     json.RawMessage `json:"partial_images,omitempty"`
	Stream            *bool           `json:"stream,omitempty"`
	Images            json.RawMessage `json:"images,omitempty"`
	Mask              json.RawMessage `json:"mask,omitempty"`
	InputFidelity     json.RawMessage `json:"input_fidelity,omitempty"`
	Watermark         *bool           `json:"watermark,omitempty"`
	// zhipu 4v
	WatermarkEnabled json.RawMessage `json:"watermark_enabled,omitempty"`
	UserId           json.RawMessage `json:"user_id,omitempty"`
	Image            json.RawMessage `json:"image,omitempty"`
	// 用匿名参数接收额外参数
	Extra             map[string]json.RawMessage `json:"-"`
	BillingParameters *ImageBillingParameters    `json:"-"`
}

// ImageCount resolves the validated request quantity. Top-level zero retains
// its legacy default of one; an explicit provider count must be positive.
func (i *ImageRequest) ImageCount(useProviderParameters bool) (int, error) {
	n := uint(1)
	if i.N != nil && *i.N != 0 {
		n = *i.N
	}
	if n > MaxImageN {
		return 0, fmt.Errorf("n must be an integer between 1 and %d", MaxImageN)
	}
	if parameters := i.BillingParameters; parameters != nil && parameters.N != nil {
		if *parameters.N > MaxImageN || useProviderParameters && *parameters.N == 0 {
			return 0, fmt.Errorf("parameters.n must be an integer between 1 and %d", MaxImageN)
		}
		if useProviderParameters {
			n = *parameters.N
		}
	}
	return int(n), nil
}

func (i *ImageRequest) UnmarshalJSON(data []byte) error {
	// 先解析成 map[string]interface{}
	var rawMap map[string]json.RawMessage
	if err := kitutil.Unmarshal(data, &rawMap); err != nil {
		return err
	}

	// 用 struct tag 获取所有已定义字段名
	knownFields := GetJSONFieldNames(reflect.TypeFor[ImageRequest]())

	// 再正常解析已定义字段
	type Alias ImageRequest
	var known Alias
	if err := kitutil.Unmarshal(data, &known); err != nil {
		return err
	}
	*i = ImageRequest(known)

	// 提取多余字段
	i.Extra = make(map[string]json.RawMessage)
	for k, v := range rawMap {
		if _, ok := knownFields[k]; !ok {
			i.Extra[k] = v
		}
	}
	return nil
}

// 序列化时需要重新把字段平铺
func (r ImageRequest) MarshalJSON() ([]byte, error) {
	// 将已定义字段转为 map
	type Alias ImageRequest
	alias := Alias(r)
	base, err := kitutil.Marshal(alias)
	if err != nil {
		return nil, err
	}

	var baseMap map[string]json.RawMessage
	if err := kitutil.Unmarshal(base, &baseMap); err != nil {
		return nil, err
	}

	// 不能合并ExtraFields！！！！！！！！
	// 合并 ExtraFields
	//for k, v := range r.Extra {
	//	if _, exists := baseMap[k]; !exists {
	//		baseMap[k] = v
	//	}
	//}

	return kitutil.Marshal(baseMap)
}

func GetJSONFieldNames(t reflect.Type) map[string]struct{} {
	fields := make(map[string]struct{})
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)

		// 跳过匿名字段（例如 ExtraFields）
		if field.Anonymous {
			continue
		}

		tag := field.Tag.Get("json")
		if tag == "-" || tag == "" {
			continue
		}

		// 取逗号前字段名（排除 omitempty 等）
		name := tag
		if commaIdx := indexComma(tag); commaIdx != -1 {
			name = tag[:commaIdx]
		}
		fields[name] = struct{}{}
	}
	return fields
}

func indexComma(s string) int {
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			return i
		}
	}
	return -1
}

func (i *ImageRequest) GetTokenCountMeta() *types.TokenCountMeta {
	imageN := uint(1)
	if i.N != nil && *i.N > 0 {
		imageN = *i.N
	}

	// Keep n separate from ImagePriceRatio so size/quality and count remain
	// independent billing dimensions. Fixed-price pre-consume stores this on
	// PriceData, and image settlement reuses or replaces the same "n" ratio.
	return &types.TokenCountMeta{
		CombineText:     i.Prompt,
		MaxTokens:       1584,
		ImagePriceRatio: i.legacyDallePriceRatio(),
		BillingRatios:   map[string]float64{"n": float64(imageN)},
	}
}

func (i *ImageRequest) IsStream(c *http.Request) bool {
	return i.Stream != nil && *i.Stream
}

func (i *ImageRequest) SetModelName(modelName string) {
	if modelName != "" {
		i.Model = modelName
	}
}

// EnsureEditImageURLs adds images[].image_url for edit endpoints that require
// it. The original image field is left unchanged so existing clients keep working.
func (i *ImageRequest) EnsureEditImageURLs() {
	if i == nil || editImagesAlreadyQualified(i.Images) {
		return
	}
	if upgraded, ok := upgradeEditImages(i.Images); ok {
		i.Images = upgraded
		if editImagesAlreadyQualified(i.Images) {
			return
		}
	}
	urls := editImageURLList(i.Image)
	if len(urls) == 0 {
		return
	}
	extra := make([]json.RawMessage, 0, len(urls))
	for _, imageURL := range urls {
		raw, err := kitutil.Marshal(map[string]string{"image_url": imageURL})
		if err != nil {
			return
		}
		extra = append(extra, raw)
	}
	items, _ := editImageItems(i.Images)
	items = append(items, extra...)
	raw, err := kitutil.Marshal(items)
	if err != nil {
		return
	}
	i.Images = raw
}

func upgradeEditImages(raw json.RawMessage) (json.RawMessage, bool) {
	items, ok := editImageItems(raw)
	if !ok || len(items) == 0 {
		return nil, false
	}
	changed := false
	upgraded := make([]json.RawMessage, len(items))
	for index, item := range items {
		next, itemChanged := upgradeEditImageItem(item)
		upgraded[index] = next
		changed = changed || itemChanged
	}
	if !changed {
		return nil, false
	}
	out, err := kitutil.Marshal(upgraded)
	if err != nil {
		return nil, false
	}
	return out, true
}

func upgradeEditImageItem(raw json.RawMessage) (json.RawMessage, bool) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return raw, false
	}
	if trimmed[0] == '"' {
		imageURL := jsonString(trimmed)
		if imageURL == "" {
			return raw, false
		}
		out, err := kitutil.Marshal(map[string]string{"image_url": imageURL})
		if err != nil {
			return raw, false
		}
		return out, true
	}
	if trimmed[0] != '{' {
		return raw, false
	}
	var obj map[string]json.RawMessage
	if err := kitutil.Unmarshal(trimmed, &obj); err != nil {
		return raw, false
	}
	if jsonString(obj["image_url"]) != "" {
		return trimmed, false
	}
	imageURL := ""
	if nested := bytes.TrimSpace(obj["image_url"]); len(nested) > 0 && nested[0] == '{' {
		imageURL = editImageURL(nested)
	}
	if imageURL == "" {
		imageURL = jsonString(obj["url"])
	}
	if imageURL == "" {
		return trimmed, false
	}
	encoded, err := kitutil.Marshal(imageURL)
	if err != nil {
		return trimmed, false
	}
	obj["image_url"] = encoded
	out, err := kitutil.Marshal(obj)
	if err != nil {
		return trimmed, false
	}
	return out, true
}

func editImagesAlreadyQualified(raw json.RawMessage) bool {
	items, ok := editImageItems(raw)
	if !ok || len(items) == 0 {
		return false
	}
	for _, item := range items {
		item = bytes.TrimSpace(item)
		if len(item) == 0 || item[0] != '{' {
			return false
		}
		var obj map[string]json.RawMessage
		if err := kitutil.Unmarshal(item, &obj); err != nil {
			return false
		}
		if jsonString(obj["image_url"]) == "" {
			return false
		}
	}
	return true
}

func editImageURLList(raw json.RawMessage) []string {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil
	}
	if trimmed[0] == '[' {
		items, ok := editImageItems(trimmed)
		if !ok {
			return nil
		}
		urls := make([]string, 0, len(items))
		for _, item := range items {
			if imageURL := editImageURL(item); imageURL != "" {
				urls = append(urls, imageURL)
			}
		}
		return urls
	}
	if imageURL := editImageURL(trimmed); imageURL != "" {
		return []string{imageURL}
	}
	return nil
}

func editImageItems(raw json.RawMessage) ([]json.RawMessage, bool) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '[' {
		return nil, false
	}
	var items []json.RawMessage
	if err := kitutil.Unmarshal(trimmed, &items); err != nil {
		return nil, false
	}
	return items, true
}

func editImageURL(raw json.RawMessage) string {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return ""
	}
	if trimmed[0] == '"' {
		return jsonString(trimmed)
	}
	if trimmed[0] != '{' {
		return ""
	}
	var obj map[string]json.RawMessage
	if err := kitutil.Unmarshal(trimmed, &obj); err != nil {
		return ""
	}
	if imageURL := jsonString(obj["image_url"]); imageURL != "" {
		return imageURL
	}
	if nested := bytes.TrimSpace(obj["image_url"]); len(nested) > 0 && nested[0] == '{' {
		if imageURL := editImageURL(nested); imageURL != "" {
			return imageURL
		}
	}
	return jsonString(obj["url"])
}

func jsonString(raw json.RawMessage) string {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '"' {
		return ""
	}
	var value string
	if err := kitutil.Unmarshal(trimmed, &value); err != nil {
		return ""
	}
	return strings.TrimSpace(value)
}

type ImageResponse struct {
	Data     []ImageData     `json:"data"`
	Created  int64           `json:"created"`
	Metadata json.RawMessage `json:"metadata,omitempty"`
}
type ImageData struct {
	Url           string `json:"url"`
	B64Json       string `json:"b64_json"`
	RevisedPrompt string `json:"revised_prompt"`
}
