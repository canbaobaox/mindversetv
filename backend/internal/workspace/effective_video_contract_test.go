package workspace

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"infinite-canvas/backend/internal/localcrypto"
)

func TestEffectiveConfigOverlaysStaleHostedSeedanceProfiles(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, LocalProviderConfigFile)
	if err := os.WriteFile(path, staleHostedSeedanceConfig(), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := NewProviderConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	// A canonical encrypted snapshot lets this test still assert that computing
	// the effective overlay does not persist catalog edits.
	document, _, err := decodeProviderDocument(staleHostedSeedanceConfig())
	if err != nil {
		t.Fatal(err)
	}
	canonical, err := store.encodeStoredDocument(document)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(path, canonical, 0600); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	// The canonical snapshot still carries the legacy channel: the rename
	// happens at load time, not at canonicalization time. decodeStoredDocument
	// migrates in memory, so read the encrypted bytes back and decrypt them
	// manually instead of going through it.
	var envelope struct {
		EncryptedConfig string `json:"encryptedConfig"`
	}
	if err := json.Unmarshal(before, &envelope); err != nil {
		t.Fatal(err)
	}
	plain, err := localcrypto.Decrypt(dir, envelope.EncryptedConfig)
	if err != nil {
		t.Fatal(err)
	}
	beforeDoc, _, err := decodeProviderDocument([]byte(plain))
	if err != nil {
		t.Fatal(err)
	}
	beforeChannels, _ := beforeDoc.Config["channels"].([]any)
	foundLegacy := false
	for _, raw := range beforeChannels {
		channel, _ := raw.(map[string]any)
		if channel["id"] == "beeftv" {
			foundLegacy = true
		}
	}
	if !foundLegacy {
		t.Fatalf("canonical snapshot lost the legacy channel: %#v", beforeChannels)
	}
	effective, _, err := store.LoadEffectiveModelConfig()
	if err != nil {
		t.Fatal(err)
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	// The one-time channel migration DOES persist (beeftv -> myxsai), but
	// the effective overlay (catalog edits) must not: the stored snapshot
	// keeps the original stale profiles, the in-memory effective config
	// carries the overlaid ones.
	stored, _, err := store.decodeStoredDocument(after)
	if err != nil {
		t.Fatal(err)
	}
	storedChannel := requireEffectiveChannel(t, EffectiveModelConfig{Config: stored.Config}, "myxsai")
	storedSeedance := requireEffectiveProfile(t, storedChannel, "seedance-2.0")
	if storedSeedance["capability"] != "text" || storedSeedance["protocol"] != "chat-completion" {
		t.Fatalf("overlay leaked into the stored snapshot: %#v", storedSeedance)
	}
	if stored.Config["imageModel"] != "myxsai::gpt-image-2" || stored.Config["videoModel"] != "myxsai::wan3.0-video" {
		t.Fatalf("stored refs not migrated: image=%#v video=%#v", stored.Config["imageModel"], stored.Config["videoModel"])
	}
	if effective.Config["imageModel"] != "myxsai::gpt-image-2" || effective.Config["videoModel"] != "myxsai::wan3.0-video" {
		t.Fatalf("user defaults changed: image=%#v video=%#v", effective.Config["imageModel"], effective.Config["videoModel"])
	}

	hosted := requireEffectiveChannel(t, effective, "myxsai")
	for _, model := range []string{"seedance-2.0", "seedance-2.0-fast", "seedance-2.0-mini", "seedance-2.5"} {
		profile := requireEffectiveProfile(t, hosted, model)
		if profile["capability"] != "video" || profile["protocol"] != "newapi" {
			t.Fatalf("hosted %s overlay = %#v", model, profile)
		}
	}
	fast := requireEffectiveProfile(t, hosted, "seedance-2.0-fast")
	if fast["displayName"] != "Seedance 2.0 Fast" {
		t.Fatalf("upstream display name was dropped: %#v", fast)
	}
	image := requireEffectiveProfile(t, hosted, "gpt-image-2")
	if image["capability"] != "image" || image["protocol"] != "openai-image" {
		t.Fatalf("hosted image profile rewritten: %#v", image)
	}

	custom := requireEffectiveChannel(t, effective, "custom-gateway")
	customFast := requireEffectiveProfile(t, custom, "seedance-2.0-fast")
	if customFast["capability"] != "text" || customFast["protocol"] != "chat-completion" {
		t.Fatalf("custom gateway capability was rewritten: %#v", customFast)
	}
	customImage := requireEffectiveProfile(t, custom, "gpt-image-2")
	if customImage["capability"] != "video" {
		t.Fatalf("custom image mislabel should stay a real type error: %#v", customImage)
	}
}

func staleHostedSeedanceConfig() []byte {
	return []byte(`{
		"imageModel":"beeftv::gpt-image-2",
		"videoModel":"beeftv::wan3.0-video",
		"channels":[
			{
				"id":"beeftv",
				"name":"BeefTV",
				"baseUrl":"https://beeftv.app",
				"enabled":true,
				"pinned":true,
				"models":["gpt-image-2","wan3.0-video","seedance-2.0","seedance-2.0-fast","seedance-2.0-mini","seedance-2.5"],
				"modelProfiles":[
					{"model":"gpt-image-2","capability":"image","protocol":"openai-image"},
					{"model":"wan3.0-video","capability":"video","protocol":"newapi-channel-2"},
					{"model":"seedance-2.0","capability":"text","protocol":"chat-completion"},
					{"model":"seedance-2.0-fast","displayName":"Seedance 2.0 Fast","capability":"text","protocol":"chat-completion"},
					{"model":"seedance-2.0-mini","capability":"text","protocol":"chat-completion"},
					{"model":"seedance-2.5","capability":"text","protocol":"chat-completion"}
				]
			},
			{
				"id":"custom-gateway",
				"baseUrl":"https://example.invalid/v1",
				"enabled":true,
				"models":["seedance-2.0-fast","gpt-image-2"],
				"modelProfiles":[
					{"model":"seedance-2.0-fast","capability":"text","protocol":"chat-completion"},
					{"model":"gpt-image-2","capability":"video","protocol":"newapi"}
				]
			}
		]
	}`)
}

func requireEffectiveProfile(t *testing.T, channel map[string]any, model string) map[string]any {
	t.Helper()
	profiles, _ := channel["modelProfiles"].([]any)
	for _, raw := range profiles {
		profile, _ := raw.(map[string]any)
		if profile["model"] == model {
			return profile
		}
	}
	t.Fatalf("missing profile %s in %#v", model, profiles)
	return nil
}
