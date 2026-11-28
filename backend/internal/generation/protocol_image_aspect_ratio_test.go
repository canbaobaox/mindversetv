package generation

import "testing"

// Resolution tier names ("1.5K", "2K", …) are billed tiers, not frame ratios:
// they must never be sent as myxsai-media's aspect_ratio (the site's field
// rejects them). Other adapters keep the old passthrough — the Agent Plan
// Seedream manifest maps body.size from request.aspectRatio with a default
// passthrough, so a tier there must still flow through. Real ratios and pixel
// sizes keep their existing behaviour everywhere.
func TestProtocolImageAspectRatioOmitsTierNames(t *testing.T) {
	cases := []struct {
		size  string
		iface string
		want  string
	}{
		{"1.5K", "myxsai-media", ""},
		{"2K", "myxsai-media", ""},
		{"1k", "myxsai-media", ""},
		{"4K", "myxsai-media", ""},
		{"2K", "", "2K"},
		{"2K", "volcengine-ark-agent-plan-image", "2K"},
		{"16:9", "", "16:9"},
		{"1:1", "", "1:1"},
		{"1024x1024", "openai-image", "1024x1024"},
	}
	for _, tc := range cases {
		got := ProtocolImageAspectRatio(Input{Mode: "image", Config: Config{Size: tc.size, InterfaceType: tc.iface}})
		if got != tc.want {
			t.Fatalf("size %q iface %q: aspect ratio = %q, want %q", tc.size, tc.iface, got, tc.want)
		}
	}
	// End to end: a 1.5K image request carries no aspect ratio, so a manifest
	// $omitEmpty(aspect_ratio) leaves the field out entirely.
	request := ProtocolRequestFromInput(Input{Mode: "image", Prompt: "x", Config: Config{Model: "doubao-seedream-5-5-261028", Size: "1.5K", InterfaceType: "myxsai-media"}})
	if request.AspectRatio != "" || request.Output.AspectRatio != "" {
		t.Fatalf("1.5K request aspect ratio = %q / output %q, want empty", request.AspectRatio, request.Output.AspectRatio)
	}
}
