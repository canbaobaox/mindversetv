package handler

import (
	"infinite-canvas/backend/internal/beeftv"
	"infinite-canvas/backend/internal/generation"

	"github.com/gin-gonic/gin"
)

// myxsaiBalanceService is the narrow surface the account page needs: the
// balance is fetched server-side with the stored channel key, so the key is
// never sent to the browser. The credential resolution and the upstream call
// live in the generation package; the handler only passes the accessors
// through, so no balance logic sits on app.Service.
type myxsaiBalanceService interface {
	workspaceOwners
	BeefTV() *beeftv.Service
	ReadLocalModelConfig() ([]byte, error)
}

func RegisterMyxsaiAccountRoutes(r *gin.RouterGroup, svc myxsaiBalanceService) {
	r.GET("/account/myxsai-balance", func(c *gin.Context) {
		if _, err := currentUser(c, svc); err != nil {
			failService(c, err)
			return
		}
		balance, err := generation.FetchMyxsaiBalance(c.Request.Context(), svc.BeefTV(), svc.ReadLocalModelConfig)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"balance": balance.Balance, "currency": balance.Currency, "hasBalance": balance.HasBalance})
	})
}
