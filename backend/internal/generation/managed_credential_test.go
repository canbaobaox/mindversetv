package generation

import (
	"testing"

	"infinite-canvas/backend/internal/beeftv"
)

// The stored channel was renamed beeftv -> myxsai; credential lookup must
// prefer the new id and keep the old one only as a fallback for documents
// not yet migrated (e.g. a task created by a stale client).
func TestLookupBeefTVCredentialPrefersMyxsaiChannel(t *testing.T) {
	readLocalConfig := func() ([]byte, error) {
		return []byte(`{"channels":[
			{"id":"myxsai","apiKey":"sk-myxsai","baseUrl":"https://api.lk888.ai"},
			{"id":"beeftv","apiKey":"sk-old","baseUrl":"https://beeftv.app"}
		]}`), nil
	}
	apiKey, baseURL, _, _, err := LookupBeefTVCredential(nil, readLocalConfig)
	if err != nil {
		t.Fatalf("lookup error: %v", err)
	}
	if apiKey != "sk-myxsai" || baseURL != "https://api.lk888.ai" {
		t.Fatalf("got apiKey=%q baseURL=%q, want sk-myxsai / https://api.lk888.ai", apiKey, baseURL)
	}
}

func TestLookupBeefTVCredentialFallsBackToLegacyBeefTVChannel(t *testing.T) {
	readLocalConfig := func() ([]byte, error) {
		return []byte(`{"channels":[{"id":"beeftv","apiKey":"sk-old"}]}`), nil
	}
	apiKey, baseURL, _, _, err := LookupBeefTVCredential(nil, readLocalConfig)
	if err != nil {
		t.Fatalf("lookup error: %v", err)
	}
	if apiKey != "sk-old" || baseURL != beeftv.ProductionOrigin {
		t.Fatalf("got apiKey=%q baseURL=%q, want sk-old / %s", apiKey, baseURL, beeftv.ProductionOrigin)
	}
}

func TestLookupBeefTVCredentialDefaultsMyxsaiBaseURL(t *testing.T) {
	readLocalConfig := func() ([]byte, error) {
		return []byte(`{"channels":[{"id":"myxsai","apiKey":"sk-myxsai"}]}`), nil
	}
	apiKey, baseURL, _, _, err := LookupBeefTVCredential(nil, readLocalConfig)
	if err != nil {
		t.Fatalf("lookup error: %v", err)
	}
	if apiKey != "sk-myxsai" || baseURL != "https://api.lk888.ai" {
		t.Fatalf("got apiKey=%q baseURL=%q, want sk-myxsai / https://api.lk888.ai", apiKey, baseURL)
	}
}

func TestLookupBeefTVCredentialReturnsEmptyWithoutKey(t *testing.T) {
	readLocalConfig := func() ([]byte, error) {
		return []byte(`{"channels":[{"id":"myxsai","apiKey":""},{"id":"beeftv","apiKey":""}]}`), nil
	}
	apiKey, baseURL, _, _, err := LookupBeefTVCredential(nil, readLocalConfig)
	if err != nil {
		t.Fatalf("lookup error: %v", err)
	}
	if apiKey != "" || baseURL != "" {
		t.Fatalf("got apiKey=%q baseURL=%q, want both empty", apiKey, baseURL)
	}
}
