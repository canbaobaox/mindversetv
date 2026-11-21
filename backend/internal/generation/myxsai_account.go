package generation

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"infinite-canvas/backend/internal/beeftv"
	"infinite-canvas/backend/internal/kernel"
	"infinite-canvas/backend/internal/outbound"
)

// MyxsaiBalance is the 梦由心生 account balance shown on the account page.
// The upstream response shape is unverified (no real key has been used
// against it yet): parseMyxsaiBalanceResponse accepts the field shapes the
// site's other endpoints use and reports the rest as an explicit "format
// unknown" error instead of guessing a number.
type MyxsaiBalance struct {
	Balance  float64 `json:"balance"`
	Currency string  `json:"currency,omitempty"`
	// HasBalance is false when the upstream answered but carried no balance
	// number the parser recognizes; the UI then shows a read failure rather
	// than a misleading 0.
	HasBalance bool `json:"hasBalance"`
}

// FetchMyxsaiBalance reads the stored myxsai channel key and calls
// GET {baseUrl}/v1/skills/balance. The key never leaves the server.
func FetchMyxsaiBalance(ctx context.Context, beef *beeftv.Service, readLocalConfig func() ([]byte, error)) (MyxsaiBalance, error) {
	apiKey, baseURL, _, _, err := LookupBeefTVCredential(beef, readLocalConfig)
	if err != nil {
		return MyxsaiBalance{}, err
	}
	if strings.TrimSpace(apiKey) == "" {
		return MyxsaiBalance{}, kernel.BadAuthRequest("尚未填写梦由心生 API Key，请先在模型渠道填写")
	}
	return fetchMyxsaiBalanceUpstream(ctx, baseURL, apiKey)
}

func fetchMyxsaiBalanceUpstream(ctx context.Context, baseURL, apiKey string) (MyxsaiBalance, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	target := strings.TrimRight(strings.TrimSpace(baseURL), "/") + "/v1/skills/balance"
	if _, err := outbound.ValidateOutboundURL(target); err != nil {
		return MyxsaiBalance{}, kernel.BadAuthRequest("梦由心生余额地址无效")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return MyxsaiBalance{}, kernel.BadAuthRequest("梦由心生余额地址无效")
	}
	request.Header.Set("Authorization", "Bearer "+apiKey)
	data, _, err := DoBinary(request)
	if err != nil {
		var httpErr HTTPError
		if errors.As(err, &httpErr) {
			if httpErr.StatusCode == http.StatusUnauthorized || httpErr.StatusCode == http.StatusForbidden {
				return MyxsaiBalance{}, kernel.Unauthorized("梦由心生 API Key 无效或无权查看余额，请检查模型渠道里的 Key")
			}
			return MyxsaiBalance{}, kernel.WrapAppError(http.StatusBadGateway, "梦由心生余额查询失败", err)
		}
		return MyxsaiBalance{}, kernel.WrapAppError(http.StatusBadGateway, "梦由心生余额查询失败", err)
	}
	return parseMyxsaiBalanceResponse(data)
}

func parseMyxsaiBalanceResponse(data []byte) (MyxsaiBalance, error) {
	var body any
	if err := json.Unmarshal(data, &body); err != nil {
		return MyxsaiBalance{}, kernel.WrapAppError(http.StatusBadGateway, "梦由心生余额返回格式无法识别", err)
	}
	root, _ := body.(map[string]any)
	if root == nil {
		return MyxsaiBalance{}, kernel.NewAppError(http.StatusBadGateway, "梦由心生余额返回格式无法识别")
	}
	for _, path := range [][]string{
		{"balance"},
		{"data", "balance"},
		{"data", "available_balance"},
		{"data", "available"},
		{"data", "credits"},
		{"credits"},
		{"available"},
		{"data", "balance_amount"},
	} {
		if value, ok := balanceNumberAt(root, path); ok {
			return MyxsaiBalance{Balance: value, Currency: balanceStringAt(root, [][]string{{"currency"}, {"data", "currency"}}), HasBalance: true}, nil
		}
	}
	return MyxsaiBalance{}, kernel.NewAppError(http.StatusBadGateway, "梦由心生余额返回格式无法识别，需真 Key 核对字段后更新解析")
}

func balanceNumberAt(root map[string]any, path []string) (float64, bool) {
	current := any(root)
	for _, key := range path {
		next, ok := current.(map[string]any)
		if !ok {
			return 0, false
		}
		current, ok = next[key]
		if !ok {
			return 0, false
		}
	}
	switch value := current.(type) {
	case float64:
		return value, true
	case json.Number:
		number, err := value.Float64()
		return number, err == nil
	case string:
		number, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		return number, err == nil
	default:
		return 0, false
	}
}

func balanceStringAt(root map[string]any, paths [][]string) string {
	for _, path := range paths {
		current := any(root)
		found := true
		for _, key := range path {
			next, ok := current.(map[string]any)
			if !ok {
				found = false
				break
			}
			current, ok = next[key]
			if !ok {
				found = false
				break
			}
		}
		if found {
			if value, ok := current.(string); ok && strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value)
			}
		}
	}
	return ""
}
