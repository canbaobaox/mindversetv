package modelcatalog

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestParseChannelModelCatalogOpenAIAndGemini(t *testing.T) {
	openAI := []byte(`{"data":[{"id":"models/b"},{"id":"a","display_name":"A","model_type":"image"}]}`)
	items, err := ParseChannelModelCatalog(openAI, "openai")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 || items[0].ID != "a" || items[1].ID != "b" || items[0].DisplayName != "A" || items[0].ModelType != "image" {
		t.Fatalf("openai catalog = %#v", items)
	}
	gemini := []byte(`{"models":[{"name":"models/gemini-pro"}]}`)
	items, err = ParseChannelModelCatalog(gemini, "gemini")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != "gemini-pro" {
		t.Fatalf("gemini catalog = %#v", items)
	}
}

// 梦由心生价格透传：上游条目平铺的广场价格字段（price_min 等）拼进 pricing；
// 没给价格（price_available 为 false，或根本没字段）时 pricing 为空，
// 前端显示“价格待确认”，不编造价格。
func TestParseChannelModelCatalogMyxsaiPricing(t *testing.T) {
	body := []byte(`{"data":[
		{"id":"doubao-seedream-5-5-261028","model_type":"image","price_min":0.05,"price_max":0.1,"output_price_min":0.2,"price_available":true,"billing_mode":"按次"},
		{"id":"no-price-model","model_type":"image","price_available":false,"billing_mode":""},
		{"id":"plain-model","model_type":"text"}
	]}`)
	items, err := ParseChannelModelCatalog(body, "openai")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 3 {
		t.Fatalf("catalog = %#v", items)
	}
	priced := items[0]
	if len(priced.Pricing) == 0 {
		t.Fatalf("priced model has no pricing: %#v", priced)
	}
	var pricing map[string]any
	if err := json.Unmarshal(priced.Pricing, &pricing); err != nil {
		t.Fatal(err)
	}
	if pricing["price_min"] != 0.05 || pricing["price_max"] != 0.1 || pricing["output_price_min"] != 0.2 || pricing["billing_mode"] != "按次" {
		t.Fatalf("pricing = %#v", pricing)
	}
	if len(items[1].Pricing) != 0 {
		t.Fatalf("price_available=false must not produce pricing: %#v", items[1])
	}
	if len(items[2].Pricing) != 0 {
		t.Fatalf("model without price fields must not produce pricing: %#v", items[2])
	}
}

func TestParseChannelModelCatalogRejectsInvalidJSONAndUpstreamError(t *testing.T) {
	if _, err := ParseChannelModelCatalog([]byte(`{"message":"ok"}`), "openai"); err == nil {
		t.Fatal("unexpected JSON schema accepted as an empty model list")
	}
	if _, err := ParseChannelModelCatalog([]byte("not-json"), "openai"); err == nil {
		t.Fatal("invalid json accepted")
	}
	if _, err := ParseChannelModelCatalog([]byte(`{"error":{"message":"nope"}}`), "openai"); err == nil {
		t.Fatal("upstream error accepted")
	}
	if _, err := ParseChannelModelCatalog([]byte(`{"code":1}`), "openai"); err == nil {
		t.Fatal("nonzero code accepted")
	}
}

func TestValidateCatalogRequest(t *testing.T) {
	if _, _, _, err := ValidateCatalogRequest("", "k", ""); err == nil {
		t.Fatal("empty url accepted")
	}
	if _, _, _, err := ValidateCatalogRequest("https://example.com/v1", "", ""); err == nil {
		t.Fatal("empty key accepted")
	}
	if _, _, _, err := ValidateCatalogRequest("https://example.com/v1", "k", "claude"); err == nil {
		t.Fatal("unsupported format accepted")
	}
	base, key, format, err := ValidateCatalogRequest(" https://example.com/v1/ ", " k ", "")
	if err != nil || base != "https://example.com/v1" || key != "k" || format != "openai" {
		t.Fatalf("normalized = %q %q %q %v", base, key, format, err)
	}
}

func TestLoadChannelModelCatalogUsesFetcher(t *testing.T) {
	called := false
	items, err := LoadChannelModelCatalog(context.Background(), func(ctx context.Context, baseURL, apiFormat, apiKey string, headers []ChannelHeader) ([]byte, error) {
		called = true
		if baseURL != "https://example.com/v1" || apiFormat != "openai" || apiKey != "k" {
			t.Fatalf("fetcher args = %q %q %q", baseURL, apiFormat, apiKey)
		}
		return []byte(`{"data":[{"id":"m1"}]}`), nil
	}, "https://example.com/v1", "openai", "k", nil, nil)
	if err != nil || !called || len(items) != 1 || items[0].ID != "m1" {
		t.Fatalf("load = %#v %v called=%v", items, err, called)
	}
	_, err = LoadChannelModelCatalog(context.Background(), func(context.Context, string, string, string, []ChannelHeader) ([]byte, error) {
		return nil, CatalogFetchError{StatusCode: 401, Cause: errors.New("no")}
	}, "https://example.com/v1", "openai", "k", nil, nil)
	if err == nil {
		t.Fatal("fetcher error dropped")
	}
}

func TestCatalogModelIDs(t *testing.T) {
	ids := CatalogModelIDs([]ChannelModelCatalogItem{{ID: "b"}, {ID: "a"}, {ID: "a"}, {ID: ""}})
	if len(ids) != 2 || ids[0] != "a" || ids[1] != "b" {
		t.Fatalf("ids = %#v", ids)
	}
}
