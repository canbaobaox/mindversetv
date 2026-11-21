package generation

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestParseMyxsaiBalanceResponse(t *testing.T) {
	cases := []struct {
		name     string
		body     string
		balance  float64
		currency string
		wantErr  bool
	}{
		{name: "top-level balance", body: `{"balance": 12.5, "currency": "CNY"}`, balance: 12.5, currency: "CNY"},
		{name: "nested data.balance", body: `{"data": {"balance": 3}}`, balance: 3},
		{name: "string available_balance", body: `{"data": {"available_balance": "42.5", "currency": "USD"}}`, balance: 42.5, currency: "USD"},
		{name: "top-level credits", body: `{"credits": 7}`, balance: 7},
		{name: "unrecognized shape", body: `{"foo": 1}`, wantErr: true},
		{name: "invalid json", body: `{`, wantErr: true},
		{name: "non-object", body: `[]`, wantErr: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseMyxsaiBalanceResponse([]byte(tc.body))
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %+v", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("parse error: %v", err)
			}
			if !got.HasBalance || got.Balance != tc.balance || got.Currency != tc.currency {
				t.Fatalf("got %+v, want balance=%v currency=%q", got, tc.balance, tc.currency)
			}
		})
	}
}

func TestFetchMyxsaiBalanceUpstream(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		if r.URL.Path != "/v1/skills/balance" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(`{"balance": 9.5, "currency": "CNY"}`))
	}))
	defer srv.Close()

	balance, err := fetchMyxsaiBalanceUpstream(context.Background(), srv.URL, "sk-test")
	if err != nil {
		t.Fatalf("fetch error: %v", err)
	}
	if gotAuth != "Bearer sk-test" {
		t.Fatalf("Authorization = %q, want Bearer sk-test", gotAuth)
	}
	if !balance.HasBalance || balance.Balance != 9.5 || balance.Currency != "CNY" {
		t.Fatalf("got %+v", balance)
	}
}

func TestFetchMyxsaiBalanceUpstreamUnauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"code": 401, "msg": "missing_api_key"}`))
	}))
	defer srv.Close()

	_, err := fetchMyxsaiBalanceUpstream(context.Background(), srv.URL, "sk-bad")
	if err == nil {
		t.Fatal("expected an error for 401")
	}
}
