package providerpreset

import "testing"

func myxsaiPreset() ChannelPreset {
	for _, preset := range BuiltinChannels() {
		if preset.ID == "myxsai" {
			return preset
		}
	}
	panic("myxsai preset missing")
}

func TestMyxsaiPresetIsUnpinnedWithoutFreezingRemoteModelCatalog(t *testing.T) {
	preset := myxsaiPreset()
	if preset.ID != "myxsai" {
		t.Fatalf("preset id = %q", preset.ID)
	}
	if preset.DisplayName != "梦由心生AI" || preset.BaseURL != "https://api.lk888.ai" {
		t.Fatalf("unexpected myxsai identity: %#v", preset)
	}
	// The myxsai channel is owned by its plugin (settings panel + one-click
	// save), so the preset must not pin it: a pinned channel cannot be
	// overwritten by a plugin upsert.
	if preset.Pinned || preset.PresetVersion < 1 {
		t.Fatalf("preset must be unpinned and versioned: %#v", preset)
	}

	if len(preset.Models) != 0 {
		t.Fatalf("remote myxsai catalog must be fetched, got %d hard-coded models", len(preset.Models))
	}
}

func TestCatalogValidationRejectsUnsafeOrAmbiguousPresets(t *testing.T) {
	valid := myxsaiPreset()
	valid.Models = []ModelProfile{{Model: "test", Capability: "text", Protocol: "chat-completion", CapabilityConfig: []byte(`{"version":1,"text":{"streaming":true}}`)}}
	tests := []struct {
		name   string
		mutate func(*ChannelPreset)
	}{
		{name: "duplicate model", mutate: func(preset *ChannelPreset) { preset.Models = append(preset.Models, preset.Models[0]) }},
		{name: "unknown protocol", mutate: func(preset *ChannelPreset) { preset.Models[0].Protocol = "mystery" }},
		{name: "missing capability", mutate: func(preset *ChannelPreset) { preset.Models[0].Capability = "" }},
		{name: "secret field", mutate: func(preset *ChannelPreset) { preset.Metadata = map[string]any{"apiKey": "must-not-ship"} }},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			candidate := valid.Clone()
			test.mutate(&candidate)
			if err := Validate(candidate); err == nil {
				t.Fatal("invalid preset was accepted")
			}
		})
	}
}
