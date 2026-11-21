package workspace

import (
	"encoding/json"
	"fmt"
	"strings"

	"infinite-canvas/backend/internal/providerpreset"
)

const providerStateSchemaVersion = 1

type ConfigHealth string

const (
	ConfigHealthReady     ConfigHealth = "ready"
	ConfigHealthDefault   ConfigHealth = "default"
	ConfigHealthMigrated  ConfigHealth = "migrated"
	ConfigHealthRecovered ConfigHealth = "recovered"
)

type ProviderStateDocument struct {
	SchemaVersion                 int            `json:"schemaVersion"`
	Revision                      int64          `json:"revision"`
	PresetVersions                map[string]int `json:"presetVersions"`
	Config                        map[string]any `json:"config"`
	AssistantDefaultAuthorization string         `json:"assistantDefaultAuthorization,omitempty"`
}

type EffectiveModelConfig struct {
	SchemaVersion  int            `json:"schemaVersion"`
	Revision       int64          `json:"revision"`
	PresetVersions map[string]int `json:"presetVersions"`
	Config         map[string]any `json:"config"`
}

func newProviderState(config map[string]any, revision int64) ProviderStateDocument {
	return ProviderStateDocument{
		SchemaVersion:  providerStateSchemaVersion,
		Revision:       revision,
		PresetVersions: builtinPresetVersions(),
		Config:         config,
	}
}

func effectiveProviderState(document ProviderStateDocument) (EffectiveModelConfig, error) {
	config, err := mergeBuiltinProviderPresets(document.Config)
	if err != nil {
		return EffectiveModelConfig{}, err
	}
	return EffectiveModelConfig{
		SchemaVersion:  providerStateSchemaVersion,
		Revision:       document.Revision,
		PresetVersions: builtinPresetVersions(),
		Config:         config,
	}, nil
}

func mergeBuiltinProviderPresets(config map[string]any) (map[string]any, error) {
	result, err := cloneMap(config)
	if err != nil {
		return nil, err
	}
	channels := map[string]map[string]any{}
	order := make([]string, 0)
	if rawChannels, ok := result["channels"].([]any); ok {
		for _, raw := range rawChannels {
			channel, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			id, _ := channel["id"].(string)
			if id == "" {
				continue
			}
			channels[id] = channel
			order = append(order, id)
		}
	}

	for _, preset := range providerpreset.BuiltinChannels() {
		local := channels[preset.ID]
		merged, err := presetChannelMap(preset, local)
		if err != nil {
			return nil, err
		}
		channels[preset.ID] = merged
		if !containsString(order, preset.ID) {
			order = append([]string{preset.ID}, order...)
		}
	}

	mergedChannels := make([]any, 0, len(order))
	for _, id := range order {
		if channel := channels[id]; channel != nil {
			mergedChannels = append(mergedChannels, overlayHostedBeefTVMediaProfiles(channel))
		}
	}
	result["channels"] = mergedChannels
	return result, nil
}

func isPluginProtocol(protocol string) bool {
	for _, prefix := range []string{"ll2-", "ysdui-", "myxsai-"} {
		if strings.HasPrefix(protocol, prefix) {
			return true
		}
	}
	return false
}

// migrateBeefTVChannelToMyxsai renames the stored official channel ("beeftv",
// or its pre-v2.2.0 id "beefapi") to the myxsai plugin channel. The rename is
// a one-time, idempotent write migration: the stored document is rewritten on
// first load with this build (see decodeStoredDocument) and later loads find
// nothing to migrate. The key, models and model profiles move as-is;
// top-level "beeftv::"/"beefapi::" model references are remapped to "myxsai::".
// When a myxsai channel already exists, the legacy channel's key, models and
// profiles fill only the gaps, then the legacy channel is dropped so the same
// upstream is not configured twice.
func migrateBeefTVChannelToMyxsai(config map[string]any) bool {
	if config == nil {
		return false
	}
	rawChannels, _ := config["channels"].([]any)
	legacyIndex := -1
	myxsaiIndex := -1
	for index, raw := range rawChannels {
		channel, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		id, _ := channel["id"].(string)
		switch id {
		case "myxsai":
			myxsaiIndex = index
		case "beeftv":
			legacyIndex = index
		case "beefapi":
			if legacyIndex < 0 {
				legacyIndex = index
			}
		}
	}
	if legacyIndex < 0 {
		return remapBeefTVModelRefs(config)
	}
	legacy, _ := rawChannels[legacyIndex].(map[string]any)
	changed := false
	if myxsaiIndex >= 0 {
		myxsai, _ := rawChannels[myxsaiIndex].(map[string]any)
		if key, _ := myxsai["apiKey"].(string); strings.TrimSpace(key) == "" {
			if legacyKey, _ := legacy["apiKey"].(string); strings.TrimSpace(legacyKey) != "" {
				myxsai["apiKey"] = legacyKey
				changed = true
			}
		}
		if models, _ := myxsai["models"].([]any); len(models) == 0 {
			if legacyModels, _ := legacy["models"].([]any); len(legacyModels) > 0 {
				myxsai["models"] = legacyModels
				changed = true
			}
		}
		if profiles, _ := myxsai["modelProfiles"].([]any); len(profiles) == 0 {
			if legacyProfiles, _ := legacy["modelProfiles"].([]any); len(legacyProfiles) > 0 {
				myxsai["modelProfiles"] = legacyProfiles
				changed = true
			}
		}
		rawChannels = append(rawChannels[:legacyIndex], rawChannels[legacyIndex+1:]...)
		config["channels"] = rawChannels
		changed = true
	} else {
		// Rename in place, preserving the channel's position in the list.
		legacy["id"] = "myxsai"
		legacy["name"] = "梦由心生AI"
		legacy["baseUrl"] = "https://api.lk888.ai"
		legacy["pinned"] = false
		delete(legacy, "credentialRef")
		delete(legacy, "legacyIds")
		legacy["ownerPluginId"] = "beeftv-plugin-myxsai"
		changed = true
	}
	if remapBeefTVModelRefs(config) {
		changed = true
	}
	return changed
}

func remapBeefTVModelRefs(config map[string]any) bool {
	changed := false
	for _, key := range []string{"model", "imageModel", "videoModel", "textModel", "audioModel", "assistantModel", "mediaReviewModel"} {
		value, _ := config[key].(string)
		for _, prefix := range []string{"beeftv::", "beefapi::"} {
			if strings.HasPrefix(value, prefix) {
				config[key] = "myxsai::" + strings.TrimPrefix(value, prefix)
				changed = true
				break
			}
		}
	}
	return changed
}

func overlayHostedBeefTVMediaProfiles(channel map[string]any) map[string]any {
	baseURL, _ := channel["baseUrl"].(string)
	profiles, _ := channel["modelProfiles"].([]any)
	seen := map[string]bool{}
	next := make([]any, 0, len(profiles))
	for _, raw := range profiles {
		profile, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		model, _ := profile["model"].(string)
		model = strings.TrimSpace(model)
		if model == "" {
			continue
		}
		seen[model] = true
		if version, _ := profile["videoCapabilitiesVersion"].(string); strings.TrimSpace(version) != "" && declaredVideoProfile(profile) {
			next = append(next, profile)
			continue
		}
		// A profile whose protocol was declared by a plugin (ll2-/ysdui-/
		// myxsai-) is authoritative; the hosted contracts are only a fallback
		// for the old managed channel, never an override of a plugin.
		if protocol, _ := profile["protocol"].(string); isPluginProtocol(protocol) {
			next = append(next, profile)
			continue
		}
		if capability, protocol, ok := hostedBeefTVMediaProfile(baseURL, model); ok {
			overlaid := cloneProfileMap(profile)
			overlaid["capability"] = capability
			overlaid["protocol"] = protocol
			next = append(next, overlaid)
			continue
		}
		next = append(next, profile)
	}
	for _, model := range channelModelIDs(channel["models"]) {
		if seen[model] {
			continue
		}
		capability, protocol, ok := hostedBeefTVMediaProfile(baseURL, model)
		if !ok {
			continue
		}
		next = append(next, map[string]any{"model": model, "capability": capability, "protocol": protocol})
	}
	channel["modelProfiles"] = next
	return channel
}

// This storage overlay only recognizes complete declarations. Capability
// validation before submission still belongs to the generation boundary.
func declaredVideoProfile(profile map[string]any) bool {
	config, _ := profile["capabilityConfig"].(map[string]any)
	video, _ := config["video"].(map[string]any)
	refs, _ := video["references"].(map[string]any)
	duration, _ := video["duration"].(map[string]any)
	operations, _ := video["operations"].([]any)
	if profile["capability"] != "video" || refs == nil || duration == nil || len(operations) == 0 {
		return false
	}
	for _, key := range []string{"maxImages", "maxVideos", "maxAudios"} {
		if number, ok := refs[key].(float64); !ok || number < 0 {
			return false
		}
	}
	if duration["selection"] != "range" && duration["selection"] != "enum" {
		return false
	}
	for _, key := range []string{"generateAudio", "watermark"} {
		control, _ := video[key].(map[string]any)
		if _, ok := control["supported"].(bool); !ok {
			return false
		}
		if _, ok := control["default"].(bool); !ok {
			return false
		}
	}
	return true
}

func hostedBeefTVMediaProfile(baseURL, model string) (string, string, bool) {
	if providerpreset.IsBeefTVEndpoint(baseURL) {
		if contract, ok := providerpreset.BeefTVImageContract(model); ok {
			return "image", contract.Protocol, true
		}
	}
	return providerpreset.HostedBeefTVVideoProfile(baseURL, model)
}

func cloneProfileMap(profile map[string]any) map[string]any {
	cloned := make(map[string]any, len(profile))
	for key, value := range profile {
		cloned[key] = value
	}
	return cloned
}

func channelModelIDs(value any) []string {
	switch items := value.(type) {
	case []string:
		ids := make([]string, 0, len(items))
		for _, item := range items {
			if model := strings.TrimSpace(item); model != "" {
				ids = append(ids, model)
			}
		}
		return ids
	case []any:
		ids := make([]string, 0, len(items))
		for _, item := range items {
			model, _ := item.(string)
			if model = strings.TrimSpace(model); model != "" {
				ids = append(ids, model)
			}
		}
		return ids
	default:
		return nil
	}
}

func presetChannelMap(preset providerpreset.ChannelPreset, local map[string]any) (map[string]any, error) {
	models := make([]string, 0, len(preset.Models))
	profiles := make([]any, 0, len(preset.Models))
	presetModels := make(map[string]struct{}, len(preset.Models))
	for _, profile := range preset.Models {
		models = append(models, profile.Model)
		presetModels[profile.Model] = struct{}{}
		var capabilityConfig any
		if err := json.Unmarshal(profile.CapabilityConfig, &capabilityConfig); err != nil {
			return nil, fmt.Errorf("decode %s capability config: %w", profile.Model, err)
		}
		profiles = append(profiles, map[string]any{
			"model": profile.Model, "capability": profile.Capability,
			"protocol": profile.Protocol, "capabilityConfig": capabilityConfig,
		})
	}
	if localModels, ok := local["models"].([]any); ok {
		for _, value := range localModels {
			model, ok := value.(string)
			if !ok || model == "" {
				continue
			}
			if _, managed := presetModels[model]; !managed && !containsString(models, model) {
				models = append(models, model)
			}
		}
	}
	if localProfiles, ok := local["modelProfiles"].([]any); ok {
		for _, value := range localProfiles {
			profile, ok := value.(map[string]any)
			if !ok {
				continue
			}
			model, _ := profile["model"].(string)
			if _, managed := presetModels[model]; model != "" && !managed {
				profiles = append(profiles, profile)
			}
		}
	}
	result := map[string]any{
		"id": preset.ID, "name": preset.DisplayName, "baseUrl": preset.BaseURL,
		"apiFormat": preset.CatalogProtocol, "scope": "user", "pinned": preset.Pinned,
		"presetVersion": preset.PresetVersion, "models": models, "modelProfiles": profiles,
		"apiKey": "", "secretKey": "", "headers": []any{}, "enabled": true,
	}
	if len(preset.LegacyIDs) > 0 {
		result["legacyIds"] = append([]string(nil), preset.LegacyIDs...)
	}
	for _, key := range []string{"apiKey", "secretKey", "headers", "enabled", "ownerPluginId"} {
		if value, ok := local[key]; ok {
			result[key] = value
		}
	}
	return result, nil
}

func builtinPresetVersions() map[string]int {
	versions := make(map[string]int)
	for _, preset := range providerpreset.BuiltinChannels() {
		versions[preset.ID] = preset.PresetVersion
	}
	return versions
}

func cloneMap(value map[string]any) (map[string]any, error) {
	if value == nil {
		return map[string]any{}, nil
	}
	body, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	var clone map[string]any
	if err := json.Unmarshal(body, &clone); err != nil {
		return nil, err
	}
	return clone, nil
}

func containsString(values []string, candidate string) bool {
	for _, value := range values {
		if value == candidate {
			return true
		}
	}
	return false
}
