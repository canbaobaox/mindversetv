package modelcatalog

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"strings"

	"infinite-canvas/backend/internal/channelurl"
	"infinite-canvas/backend/internal/kernel"
)

type CatalogJSONError struct{ Cause error }

func (e CatalogJSONError) Error() string { return "模型服务返回的不是有效 JSON" }
func (e CatalogJSONError) Unwrap() error { return e.Cause }

type CatalogUpstreamRejectedError struct{}

func (CatalogUpstreamRejectedError) Error() string {
	return "模型服务返回失败，请检查渠道配置"
}

type catalogPayload struct {
	Data   []catalogPayloadItem `json:"data"`
	Models []catalogPayloadItem `json:"models"`
	Error  *catalogPayloadError `json:"error"`
	Code   *int                 `json:"code"`
}

type catalogPayloadError struct {
	Message string `json:"message"`
}

type catalogPayloadItem struct {
	ID                       string                   `json:"id"`
	Name                     string                   `json:"name"`
	DisplayName              string                   `json:"display_name"`
	ModelType                string                   `json:"model_type"`
	SupportedEndpointTypes   []string                 `json:"supported_endpoint_types"`
	DefaultParameters        catalogPayloadParameters `json:"default_parameters"`
	Options                  catalogPayloadOptions    `json:"options"`
	SupportsImages           *bool                    `json:"supports_images"`
	MinImages                *int                     `json:"min_images"`
	MaxImages                *int                     `json:"max_images"`
	ImageCapabilities        json.RawMessage          `json:"image_capabilities"`
	ImageCapabilitiesVersion string                   `json:"image_capabilities_version"`
	VideoCapabilities        json.RawMessage          `json:"video_capabilities"`
	VideoCapabilitiesVersion string                   `json:"video_capabilities_version"`
	VideoPricing             json.RawMessage          `json:"video_pricing"`
	// 梦由心生价格：字段名以模型广场公开接口 /gongkai/moxingguangchang 的实测
	// 返回为准（price_min / price_max / output_price_min / price_available /
	// billing_mode）。上游没给时保持空，前端显示“价格待确认”。
	PriceMin                 *float64        `json:"price_min"`
	PriceMax                 *float64        `json:"price_max"`
	OutputPriceMin           *float64        `json:"output_price_min"`
	PriceAvailable           *bool           `json:"price_available"`
	BillingMode              string          `json:"billing_mode"`
	MediaCapabilities        json.RawMessage `json:"media_capabilities"`
	MediaCapabilitiesVersion string          `json:"media_capabilities_version"`
}

type catalogPayloadParameters struct {
	AspectRatio     string `json:"aspect_ratio"`
	DurationSeconds string `json:"duration_seconds"`
	Resolution      string `json:"resolution"`
}

type catalogPayloadOptions struct {
	AspectRatio     []ChannelModelCatalogOption `json:"aspect_ratio"`
	DurationSeconds []ChannelModelCatalogOption `json:"duration_seconds"`
	Resolution      []ChannelModelCatalogOption `json:"resolution"`
}

func NormalizeCatalogAPIFormat(apiFormat string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(apiFormat))
	if normalized == "" {
		normalized = "openai"
	}
	if normalized != "openai" && normalized != "gemini" {
		return "", kernel.BadAuthRequest("接口协议不支持拉取模型")
	}
	return normalized, nil
}

// CatalogBaseURL 是读取模型目录前对 Base URL 的整理；设置页展示目录地址也先过这一步。
func CatalogBaseURL(baseURL string) string {
	return channelurl.NormalizeBase(baseURL)
}

func ValidateCatalogRequest(baseURL, apiKey, apiFormat string) (string, string, string, error) {
	baseURL = CatalogBaseURL(baseURL)
	apiKey = strings.TrimSpace(apiKey)
	if baseURL == "" {
		return "", "", "", kernel.BadAuthRequest("请填写 Base URL")
	}
	if apiKey == "" {
		return "", "", "", kernel.BadAuthRequest("请填写 API Key")
	}
	normalizedFormat, err := NormalizeCatalogAPIFormat(apiFormat)
	if err != nil {
		return "", "", "", err
	}
	return baseURL, apiKey, normalizedFormat, nil
}

func LoadChannelModelCatalog(ctx context.Context, fetcher CatalogFetcher, baseURL, apiFormat, apiKey string, headers []ChannelHeader, extras CatalogExtraSource) ([]ChannelModelCatalogItem, error) {
	baseURL, apiKey, apiFormat, err := ValidateCatalogRequest(baseURL, apiKey, apiFormat)
	if err != nil {
		return nil, err
	}
	if fetcher == nil {
		return nil, CatalogFetchError{Cause: kernel.BadAuthRequest("模型服务地址无效")}
	}
	data, err := fetcher(ctx, baseURL, apiFormat, apiKey, headers)
	if err != nil {
		return nil, err
	}
	catalog, err := ParseChannelModelCatalog(data, apiFormat)
	if err != nil {
		return nil, err
	}
	catalog = OverlayCatalogVideoCapabilities(catalog)
	if extras != nil {
		catalog = MergeCatalogExtras(catalog, extras(baseURL, apiFormat, headers))
	}
	return catalog, nil
}

func ParseChannelModelCatalog(data []byte, apiFormat string) ([]ChannelModelCatalogItem, error) {
	apiFormat, err := NormalizeCatalogAPIFormat(apiFormat)
	if err != nil {
		return nil, err
	}
	var payload catalogPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, CatalogJSONError{Cause: err}
	}
	if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
		return nil, CatalogUpstreamRejectedError{}
	}
	if payload.Code != nil && *payload.Code != 0 {
		return nil, CatalogUpstreamRejectedError{}
	}
	items := payload.Data
	if apiFormat == "gemini" {
		items = payload.Models
	}
	if items == nil {
		return nil, CatalogJSONError{Cause: errors.New("missing model catalog array")}
	}
	seen := make(map[string]bool, len(items))
	catalog := make([]ChannelModelCatalogItem, 0, len(items))
	for _, item := range items {
		name := strings.TrimPrefix(strings.TrimSpace(kernel.FirstNonEmpty(item.ID, item.Name)), "models/")
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		entry := ChannelModelCatalogItem{
			ID:                     name,
			DisplayName:            strings.TrimSpace(item.DisplayName),
			ModelType:              NormalizeCatalogModelType(item.ModelType),
			SupportedEndpointTypes: NormalizeCatalogEndpointTypes(item.SupportedEndpointTypes),
			DefaultParameters: ChannelModelCatalogDefaultParameters{
				AspectRatio:     strings.TrimSpace(item.DefaultParameters.AspectRatio),
				DurationSeconds: strings.TrimSpace(item.DefaultParameters.DurationSeconds),
				Resolution:      strings.TrimSpace(item.DefaultParameters.Resolution),
			},
			Options: ChannelModelCatalogOptions{
				AspectRatio:     NormalizeCatalogOptions(item.Options.AspectRatio),
				DurationSeconds: NormalizeCatalogOptions(item.Options.DurationSeconds),
				Resolution:      NormalizeCatalogOptions(item.Options.Resolution),
			},
			SupportsImages:    item.SupportsImages,
			MinImages:         item.MinImages,
			MaxImages:         item.MaxImages,
			ImageCapabilities: item.ImageCapabilities,
			VideoCapabilities: item.VideoCapabilities,
			VideoPricing:      item.VideoPricing,
			Pricing:           catalogPricing(item),
			MediaCapabilities: item.MediaCapabilities,
		}
		if version := strings.TrimSpace(item.ImageCapabilitiesVersion); version != "" || len(item.ImageCapabilities) > 0 {
			copied := version
			entry.ImageCapabilitiesVersion = &copied
		}
		if version := strings.TrimSpace(item.VideoCapabilitiesVersion); version != "" || len(item.VideoCapabilities) > 0 {
			copied := version
			entry.VideoCapabilitiesVersion = &copied
		}
		if version := strings.TrimSpace(item.MediaCapabilitiesVersion); version != "" || len(item.MediaCapabilities) > 0 {
			copied := version
			entry.MediaCapabilitiesVersion = &copied
		}
		catalog = append(catalog, entry)
	}
	sort.Slice(catalog, func(left int, right int) bool {
		return catalog[left].ID < catalog[right].ID
	})
	return catalog, nil
}

// catalogPricing 把上游模型条目里平铺的梦由心生价格字段拼成 pricing 对象。
// 字段名以模型广场公开接口为准；没给价格（price_min 缺失/非法，或
// price_available 明确为 false）时返回 nil，前端显示“价格待确认”。
func catalogPricing(item catalogPayloadItem) json.RawMessage {
	if item.PriceMin == nil || math.IsNaN(*item.PriceMin) || math.IsInf(*item.PriceMin, 0) || *item.PriceMin < 0 {
		return nil
	}
	if item.PriceAvailable != nil && !*item.PriceAvailable {
		return nil
	}
	pricing := map[string]any{"price_min": *item.PriceMin}
	if item.PriceMax != nil && !math.IsNaN(*item.PriceMax) && !math.IsInf(*item.PriceMax, 0) && *item.PriceMax >= 0 {
		pricing["price_max"] = *item.PriceMax
	}
	if item.OutputPriceMin != nil && !math.IsNaN(*item.OutputPriceMin) && !math.IsInf(*item.OutputPriceMin, 0) && *item.OutputPriceMin >= 0 {
		pricing["output_price_min"] = *item.OutputPriceMin
	}
	if mode := strings.TrimSpace(item.BillingMode); mode != "" {
		pricing["billing_mode"] = mode
	}
	raw, err := json.Marshal(pricing)
	if err != nil {
		return nil
	}
	return raw
}

func CatalogModelIDs(items []ChannelModelCatalogItem) []string {
	seen := make(map[string]bool, len(items))
	models := make([]string, 0, len(items))
	for _, item := range items {
		name := strings.TrimSpace(item.ID)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		models = append(models, name)
	}
	sort.Strings(models)
	return models
}
