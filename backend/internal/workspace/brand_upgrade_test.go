package workspace

import (
	"testing"
)

func TestMigrateBeefTVChannelToMyxsaiRenamesStoredChannel(t *testing.T) {
	config := map[string]any{
		"channels": []any{
			map[string]any{
				"id": "beeftv", "name": "梦由心生AI", "baseUrl": "https://beeftv.app",
				"apiKey": "sk-stored", "pinned": true, "credentialRef": "beeftv",
				"models":        []any{"doubao-seed-2-1-pro-260628"},
				"modelProfiles": []any{map[string]any{"model": "doubao-seed-2-1-pro-260628", "capability": "text", "protocol": "chat-completion"}},
			},
		},
		"model":          "beeftv::doubao-seed-2-1-pro-260628",
		"assistantModel": "beeftv::deepseek-v4-pro",
		"imageModel":     "other::qwen-image",
	}
	if !migrateBeefTVChannelToMyxsai(config) {
		t.Fatal("migration reported no change")
	}
	channels, _ := config["channels"].([]any)
	if len(channels) != 1 {
		t.Fatalf("channels = %#v", channels)
	}
	channel, _ := channels[0].(map[string]any)
	if channel["id"] != "myxsai" || channel["name"] != "梦由心生AI" || channel["baseUrl"] != "https://api.lk888.ai" {
		t.Fatalf("migrated channel = %#v", channel)
	}
	if channel["pinned"] != false || channel["apiKey"] != "sk-stored" || channel["ownerPluginId"] != "beeftv-plugin-myxsai" {
		t.Fatalf("migrated channel lost state: %#v", channel)
	}
	if _, hasCredentialRef := channel["credentialRef"]; hasCredentialRef {
		t.Fatalf("migrated channel must not keep the managed credentialRef: %#v", channel)
	}
	if models, _ := channel["models"].([]any); len(models) != 1 || models[0] != "doubao-seed-2-1-pro-260628" {
		t.Fatalf("models = %#v", models)
	}
	if profiles, _ := channel["modelProfiles"].([]any); len(profiles) != 1 {
		t.Fatalf("modelProfiles = %#v", profiles)
	}
	if config["model"] != "myxsai::doubao-seed-2-1-pro-260628" || config["assistantModel"] != "myxsai::deepseek-v4-pro" {
		t.Fatalf("model refs not remapped: model=%v assistantModel=%v", config["model"], config["assistantModel"])
	}
	if config["imageModel"] != "other::qwen-image" {
		t.Fatalf("unrelated ref changed: %#v", config["imageModel"])
	}
	// Idempotent: a second run changes nothing.
	if migrateBeefTVChannelToMyxsai(config) {
		t.Fatal("migration is not idempotent")
	}
}

func TestMigrateBeefTVChannelToMyxsaiHandlesLegacyBeefapiID(t *testing.T) {
	config := map[string]any{
		"channels": []any{
			map[string]any{"id": "beefapi", "name": "old", "baseUrl": "https://beeftv.app", "apiKey": "sk-legacy", "pinned": true},
		},
		"model": "beefapi::doubao-seed-2-1-pro-260628",
	}
	if !migrateBeefTVChannelToMyxsai(config) {
		t.Fatal("migration reported no change")
	}
	channels, _ := config["channels"].([]any)
	channel, _ := channels[0].(map[string]any)
	if channel["id"] != "myxsai" || channel["apiKey"] != "sk-legacy" {
		t.Fatalf("migrated channel = %#v", channel)
	}
	if config["model"] != "myxsai::doubao-seed-2-1-pro-260628" {
		t.Fatalf("model ref not remapped: %#v", config["model"])
	}
}

func TestMigrateBeefTVChannelToMyxsaiMergesIntoExistingChannel(t *testing.T) {
	config := map[string]any{
		"channels": []any{
			map[string]any{"id": "myxsai", "name": "梦由心生AI", "baseUrl": "https://api.lk888.ai", "apiKey": "", "models": []any{}, "modelProfiles": []any{}},
			map[string]any{"id": "beeftv", "name": "梦由心生AI", "baseUrl": "https://api.lk888.ai", "apiKey": "sk-stored", "models": []any{"kimi-k3"}, "modelProfiles": []any{map[string]any{"model": "kimi-k3", "capability": "text", "protocol": "chat-completion"}}},
		},
	}
	if !migrateBeefTVChannelToMyxsai(config) {
		t.Fatal("migration reported no change")
	}
	channels, _ := config["channels"].([]any)
	if len(channels) != 1 {
		t.Fatalf("legacy channel was not dropped: %#v", channels)
	}
	channel, _ := channels[0].(map[string]any)
	if channel["id"] != "myxsai" || channel["apiKey"] != "sk-stored" {
		t.Fatalf("key was not carried over: %#v", channel)
	}
	if models, _ := channel["models"].([]any); len(models) != 1 || models[0] != "kimi-k3" {
		t.Fatalf("models = %#v", models)
	}
	if profiles, _ := channel["modelProfiles"].([]any); len(profiles) != 1 {
		t.Fatalf("modelProfiles = %#v", profiles)
	}
}

func TestMigrateBeefTVChannelToMyxsaiLeavesCleanConfigAlone(t *testing.T) {
	config := map[string]any{
		"channels": []any{
			map[string]any{"id": "myxsai", "name": "梦由心生AI", "baseUrl": "https://api.lk888.ai", "apiKey": "sk-x"},
		},
		"model": "myxsai::kimi-k3",
	}
	if migrateBeefTVChannelToMyxsai(config) {
		t.Fatal("migration changed a config with nothing to migrate")
	}
}
