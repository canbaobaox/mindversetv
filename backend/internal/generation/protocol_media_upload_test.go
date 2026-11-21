package generation

import "testing"

// The ysdui vendor is gone (plugin replacement, 2026-11-21): its file-upload
// service, COS URLs and ysdui-image/ysdui-video create shapes no longer
// exist, so the three tests that exercised media pre-upload against that
// vendor were removed with it. The generic hydration policy
// (MediaHydrationPolicyFor / HydrateMedia) is still covered by
// media_mask_test.go, media_preflight_test.go and
// reference_storage_preparation_test.go. The manifest upload-URL routing
// below is vendor-independent (the ysdui URLs are only fixtures).

func TestProtocolMediaUploadTargetUsesManifestUploadURLForConfiguredVendor(t *testing.T) {
	if !useManifestUploadURL("https://tokenhub.ysdui.cn", "https://tokenhub.ysdui.cn", "https://ysdui.cn/api/file/v1/upload") {
		t.Fatal("expected tokenhub.ysdui.cn to route uploads to ysdui.cn")
	}
	if !useManifestUploadURL("https://ysdui.cn", "https://tokenhub.ysdui.cn", "https://ysdui.cn/api/file/v1/upload") {
		t.Fatal("expected ysdui.cn to route uploads to ysdui.cn")
	}
	if useManifestUploadURL("http://127.0.0.1:18080", "https://tokenhub.ysdui.cn", "https://ysdui.cn/api/file/v1/upload") {
		t.Fatal("expected local test server to keep its own origin")
	}
	if useManifestUploadURL("https://tokenhub.ysdui.cn", "https://tokenhub.ysdui.cn", "https://127.0.0.1:8443/api/file/v1/upload") {
		t.Fatal("expected loopback upload URL to be rejected even when config matches manifest base")
	}
	if useManifestUploadURL("https://tokenhub.ysdui.cn", "https://tokenhub.ysdui.cn", "https://evil.example.com/api/file/v1/upload") {
		t.Fatal("expected unrelated upload domain to be rejected even when config matches manifest base")
	}
}
