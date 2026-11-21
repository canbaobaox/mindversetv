package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

// The hosted contract overlay must not rewrite profiles whose protocol was
// declared by a plugin (myxsai-media / ll2-* / ysdui-*): those protocols are
// authoritative, the hosted contracts are only a fallback for the managed
// channel. Without the skip, seedance-2.5-guanfang would be rewritten to
// "newapi" and wan3.0 to "newapi-channel-2", both dead ends on lk888.
func TestEffectiveConfigKeepsPluginDeclaredMyxsaiMediaProfiles(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, LocalProviderConfigFile)
	if err := os.WriteFile(path, myxsaiMediaConfig(), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := NewProviderConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	effective, _, err := store.LoadEffectiveModelConfig()
	if err != nil {
		t.Fatal(err)
	}
	channel := requireEffectiveChannel(t, effective, "myxsai")
	for model, want := range map[string]string{
		"seedance-2.5-guanfang": "myxsai-media",
		"wan3.0":                "myxsai-media",
		"ll2-test-video":        "ll2-seedance-video",
	} {
		profile := requireEffectiveProfile(t, channel, model)
		if profile["protocol"] != want {
			t.Fatalf("%s: protocol = %#v, want %q (overlay clobbered a plugin protocol)", model, profile["protocol"], want)
		}
		if profile["capability"] != "video" {
			t.Fatalf("%s: capability = %#v, want video", model, profile["capability"])
		}
	}
	// The overlay still repairs stale non-plugin profiles on the same channel.
	stale := requireEffectiveProfile(t, channel, "seedance-2.0")
	if stale["capability"] != "video" || stale["protocol"] != "newapi" {
		t.Fatalf("stale non-plugin profile not repaired: %#v", stale)
	}
}

func myxsaiMediaConfig() []byte {
	return []byte(`{
		"channels":[
			{
				"id":"myxsai",
				"name":"梦由心生AI",
				"baseUrl":"https://api.lk888.ai",
				"enabled":true,
				"pinned":false,
				"models":["seedance-2.5-guanfang","wan3.0","ll2-test-video","seedance-2.0"],
				"modelProfiles":[
					{"model":"seedance-2.5-guanfang","capability":"video","protocol":"myxsai-media"},
					{"model":"wan3.0","capability":"video","protocol":"myxsai-media"},
					{"model":"ll2-test-video","capability":"video","protocol":"ll2-seedance-video"},
					{"model":"seedance-2.0","capability":"text","protocol":"chat-completion"}
				]
			}
		]
	}`)
}
