package topaz

import "testing"

func TestOfficialUpscaleParameters(t *testing.T) {
	for _, mode := range Modes() {
		r := Request{ResourceID: "owned", ChannelID: "beeftv", Mode: mode.Mode, Model: mode.Models[0], Scale: 2, OutputFormat: mode.OutputFormats[0]}
		if err := Validate(r, mode.MediaType); err != nil {
			t.Fatal(err)
		}
		if ModelID(r.Model) == "" {
			t.Fatal("missing official model mapping")
		}
		r.ChannelID = "fal"
		if Validate(r, mode.MediaType) == nil {
			t.Fatal("direct provider credential accepted")
		}
		// 内置渠道已迁移到 myxsai：前端超分节点发 channelId "myxsai"，
		// 后端只认 "beeftv" 会让提交在门禁放行后才报错；两个 ID 都接受。
		r.ChannelID = "myxsai"
		if err := Validate(r, mode.MediaType); err != nil {
			t.Fatalf("myxsai channel rejected: %v", err)
		}
		r.ChannelID, r.Scale = "beeftv", 1.5
		if Validate(r, mode.MediaType) == nil {
			t.Fatal("unsupported fractional scale accepted")
		}
	}
}
