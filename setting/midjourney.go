package setting

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

const (
	MjModeFast  = "fast"
	MjModeRelax = "relax"
	MjModeTurbo = "turbo"
	MjModeDraft = "draft"
)

type MjGroupModeRule struct {
	Allowed []string `json:"allowed"`
	Default string   `json:"default"`
}

var MjNotifyEnabled = false
var MjAccountFilterEnabled = false
var MjModeClearEnabled = false
var MjForwardUrlEnabled = true
var MjActionCheckSuccessEnabled = true
var MjModePathPrefixEnabled = true

var mjModeMu sync.RWMutex
var mjModeRatio = map[string]float64{
	MjModeFast:  1,
	MjModeRelax: 1,
	MjModeTurbo: 2,
	MjModeDraft: 0.5,
}
var mjGroupModePolicy = map[string]MjGroupModeRule{}

func GetMjModeRatio(mode string) float64 {
	mjModeMu.RLock()
	defer mjModeMu.RUnlock()
	if ratio, ok := mjModeRatio[mode]; ok && ratio > 0 {
		return ratio
	}
	return 1
}

func MjModeRatio2JSON() string {
	mjModeMu.RLock()
	defer mjModeMu.RUnlock()
	b, err := common.Marshal(mjModeRatio)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func UpdateMjModeRatioByJSONString(value string) error {
	parsed := map[string]float64{}
	if err := common.UnmarshalJsonStr(value, &parsed); err != nil {
		return err
	}
	next := map[string]float64{
		MjModeFast:  1,
		MjModeRelax: 1,
		MjModeTurbo: 2,
		MjModeDraft: 0.5,
	}
	for key, ratio := range parsed {
		if ratio > 0 {
			next[key] = ratio
		}
	}
	mjModeMu.Lock()
	mjModeRatio = next
	mjModeMu.Unlock()
	return nil
}

func GetMjGroupModePolicy(group string) (MjGroupModeRule, bool) {
	mjModeMu.RLock()
	defer mjModeMu.RUnlock()
	rule, ok := mjGroupModePolicy[group]
	return rule, ok
}

func MjGroupModePolicy2JSON() string {
	mjModeMu.RLock()
	defer mjModeMu.RUnlock()
	b, err := common.Marshal(mjGroupModePolicy)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func UpdateMjGroupModePolicyByJSONString(value string) error {
	parsed := map[string]MjGroupModeRule{}
	if err := common.UnmarshalJsonStr(value, &parsed); err != nil {
		return err
	}
	mjModeMu.Lock()
	mjGroupModePolicy = parsed
	mjModeMu.Unlock()
	return nil
}
