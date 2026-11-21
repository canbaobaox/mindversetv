package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"infinite-canvas/backend/internal/app"
	"infinite-canvas/backend/internal/beeftv"
	"infinite-canvas/backend/internal/database"
	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/repository"
	"infinite-canvas/backend/internal/workspace"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// newMyxsaiBalanceService builds a repo-backed local service: currentUser
// needs a real workspace row, a nil-repo service answers 401.
func newMyxsaiBalanceService(t *testing.T, dir string) *app.Service {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := database.MigrateLocalSchema(db); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.Workspace{ID: "local", Name: "本地工作区"}).Error; err != nil {
		t.Fatal(err)
	}
	return app.NewLocal(repository.New(db), dir)
}

// stubMyxsaiBalanceService answers the balance from a canned local config:
// the credential lookup reads these bytes directly (no preset merge), so the
// fake upstream is reachable. The upstream call itself is covered by
// TestFetchMyxsaiBalanceUpstream; this test covers route wiring, auth gating
// and the response envelope.
type stubMyxsaiBalanceService struct {
	*app.Service
	configJSON []byte
}

func (s stubMyxsaiBalanceService) BeefTV() *beeftv.Service { return nil }

func (s stubMyxsaiBalanceService) ReadLocalModelConfig() ([]byte, error) {
	return s.configJSON, nil
}

func TestMyxsaiBalanceRouteReturnsServerSideBalance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	store, err := workspace.NewProviderConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/skills/balance" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer sk-test" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"balance": 42.5, "currency": "CNY"}`))
	}))
	defer upstream.Close()

	service := stubMyxsaiBalanceService{
		Service:    newMyxsaiBalanceService(t, dir),
		configJSON: []byte(fmt.Sprintf(`{"channels":[{"id":"myxsai","name":"梦由心生AI","baseUrl":%q,"apiKey":"sk-test","enabled":true}]}`, upstream.URL)),
	}
	router := newMyxsaiBalanceRouter(dir, store, service)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/account/myxsai-balance", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	var envelope struct {
		Code int `json:"code"`
		Data struct {
			Balance    float64 `json:"balance"`
			Currency   string  `json:"currency"`
			HasBalance bool    `json:"hasBalance"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Code != 0 || !envelope.Data.HasBalance || envelope.Data.Balance != 42.5 || envelope.Data.Currency != "CNY" {
		t.Fatalf("envelope = %+v", envelope)
	}
}

func TestMyxsaiBalanceRouteWithoutKeyFails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	store, err := workspace.NewProviderConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	service := newMyxsaiBalanceService(t, dir)
	router := newMyxsaiBalanceRouter(dir, store, service)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/account/myxsai-balance", nil))
	var envelope struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Code == 0 {
		t.Fatalf("expected a non-zero code without a stored key, body=%s", recorder.Body.String())
	}
}

func newMyxsaiBalanceRouter(dir string, store *workspace.ProviderConfig, service myxsaiBalanceService) *gin.Engine {
	router := gin.New()
	router.Use(WorkspaceMiddleware(workspace.Context{ID: "local", DataDir: dir}))
	router.Use(RuntimeDependenciesMiddleware(RuntimeDependencies{
		RequestCoordinator: &stubRequestCoordinator{allowed: true},
		ProviderConfig:     store,
	}))
	RegisterMyxsaiAccountRoutes(router.Group("/api"), service)
	return router
}
