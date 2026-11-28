package modelcatalog

import "testing"

func TestParseLocalChannelModels(t *testing.T) {
	body := []byte(`{"channels":[{"id":"ch1","baseUrl":"https://example.com/v1","enabled":true,"models":["img","skip"],"modelProfiles":[{"model":"img","displayName":"Image","capability":"image","protocol":"openai-image"}]}]}`)
	items := ParseLocalChannelModels(body)
	if len(items) != 2 || items[0].Model != "img" || items[0].DisplayName != "Image" {
		t.Fatalf("parsed = %#v", items)
	}
}

func TestLocalChannelModelMyxsaiPrice(t *testing.T) {
	flat := func(raw string) *MyxsaiFlatPrice {
		return LocalChannelModel{ChannelID: "myxsai", Pricing: []byte(raw)}.MyxsaiPrice()
	}
	got := flat(`{"price_min":0.0812,"price_max":0.1,"output_price_min":0.02,"billing_mode":"按次","currency":"CNY","other":1}`)
	if got == nil || got.PriceMin != 0.0812 || got.PriceMax == nil || *got.PriceMax != 0.1 || got.OutputPriceMin == nil || *got.OutputPriceMin != 0.02 || got.BillingMode != "按次" {
		t.Fatalf("flat price = %#v", got)
	}
	// CamelCase is what the plugin emits and wins when both spellings agree.
	camel := flat(`{"priceMin":0.0812,"priceMax":0.1,"outputPriceMin":0.02,"billingMode":"按次","currency":"CNY","other":1}`)
	if camel == nil || camel.PriceMin != 0.0812 || camel.PriceMax == nil || *camel.PriceMax != 0.1 || camel.OutputPriceMin == nil || *camel.OutputPriceMin != 0.02 || camel.BillingMode != "按次" {
		t.Fatalf("camelCase flat price = %#v", camel)
	}
	// When both spellings are present, camelCase wins; when only one spelling
	// carries a legal priceMin, that one is adopted.
	both := flat(`{"priceMin":0.05,"price_min":0.09,"priceMax":0.06,"price_max":0.07,"billingMode":"按次","billing_mode":"按秒"}`)
	if both == nil || both.PriceMin != 0.05 || both.PriceMax == nil || *both.PriceMax != 0.06 || both.BillingMode != "按次" {
		t.Fatalf("both spellings flat price = %#v", both)
	}
	fallback := flat(`{"priceMin":-1,"price_min":0.09,"billingMode":"按秒"}`)
	if fallback == nil || fallback.PriceMin != 0.09 || fallback.BillingMode != "按秒" {
		t.Fatalf("illegal camelCase priceMin must fall back to snake_case: %#v", fallback)
	}
	// Only the myxsai channel may carry a flat price.
	if other := (LocalChannelModel{ChannelID: "beeftv", Pricing: []byte(`{"price_min":0.0812,"billing_mode":"按次"}`)}).MyxsaiPrice(); other != nil {
		t.Fatalf("non-myxsai channel must not expose a flat price: %#v", other)
	}
	for _, raw := range []string{
		`{"price_min":-1,"billing_mode":"按次"}`,
		`{"price_max":0.1,"billing_mode":"按次"}`,
		`{"price_min":"0.0812","billing_mode":"按次"}`,
		`not json`,
		``,
	} {
		if price := flat(raw); price != nil {
			t.Fatalf("pricing %s must yield no flat price, got %#v", raw, price)
		}
	}
	// Invalid optional fields are dropped, not fatal to the whole quote.
	partial := flat(`{"price_min":0.05,"price_max":-1,"output_price_min":"x","billing_mode":"按token"}`)
	if partial == nil || partial.PriceMin != 0.05 || partial.PriceMax != nil || partial.OutputPriceMin != nil || partial.BillingMode != "按token" {
		t.Fatalf("partial flat price = %#v", partial)
	}
}

func TestPublicCatalogFromLocalSnapshotCarriesMyxsaiPrice(t *testing.T) {
	body := []byte(`{"channels":[
		{"id":"myxsai","name":"梦由心生AI","enabled":true,"models":["doubao-seedream-5-5-261028"],
		 "modelProfiles":[{"model":"doubao-seedream-5-5-261028","displayName":"即梦 5.5","capability":"image","protocol":"openai-image",
		 "pricing":{"priceMin":0.0812,"billingMode":"按次"}}]},
		{"id":"custom","name":"Custom","enabled":true,"models":["plain"],
		 "modelProfiles":[{"model":"plain","displayName":"Plain","capability":"image","protocol":"openai-image",
		 "pricing":{"price_min":0.5,"billing_mode":"按次"}}]}
	]}`)
	response, err := PublicCatalogFromLocalSnapshot(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(response.Channels) != 2 {
		t.Fatalf("channels = %#v", response.Channels)
	}
	myxsai := response.Channels[0].Models[0]
	if myxsai.MyxsaiPrice == nil || myxsai.MyxsaiPrice.PriceMin != 0.0812 || myxsai.MyxsaiPrice.BillingMode != "按次" {
		t.Fatalf("myxsai model = %#v", myxsai)
	}
	// The flat price must not be smuggled into the CNY-only Table.
	if myxsai.Pricing != nil {
		t.Fatalf("flat price must not become a CNY table: %#v", myxsai.Pricing)
	}
	if custom := response.Channels[1].Models[0]; custom.MyxsaiPrice != nil {
		t.Fatalf("custom channel must not expose a flat price: %#v", custom)
	}
}
