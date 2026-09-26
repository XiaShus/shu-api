package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
)

func TestGetMjRequestPath(t *testing.T) {
	original := setting.MjModePathPrefixEnabled
	t.Cleanup(func() {
		setting.MjModePathPrefixEnabled = original
	})

	tests := []struct {
		name   string
		path   string
		mode   string
		prefix bool
		want   string
	}{
		{
			name:   "default fast stays on /mj",
			path:   "/mj/submit/imagine",
			mode:   setting.MjModeFast,
			prefix: true,
			want:   "/mj/submit/imagine",
		},
		{
			name:   "relax uses mode prefix",
			path:   "/mj/submit/imagine",
			mode:   setting.MjModeRelax,
			prefix: true,
			want:   "/mj-relax/mj/submit/imagine",
		},
		{
			name:   "turbo uses mode prefix",
			path:   "/mj/submit/imagine",
			mode:   setting.MjModeTurbo,
			prefix: true,
			want:   "/mj-turbo/mj/submit/imagine",
		},
		{
			name:   "explicit mj-fast keeps prefix",
			path:   "/mj-fast/mj/submit/imagine",
			mode:   setting.MjModeFast,
			prefix: true,
			want:   "/mj-fast/mj/submit/imagine",
		},
		{
			name:   "explicit /fast/mj keeps prefix",
			path:   "/fast/mj/submit/imagine",
			mode:   setting.MjModeFast,
			prefix: true,
			want:   "/mj-fast/mj/submit/imagine",
		},
		{
			name:   "draft never prefixes",
			path:   "/mj/submit/imagine",
			mode:   setting.MjModeDraft,
			prefix: true,
			want:   "/mj/submit/imagine",
		},
		{
			name:   "prefix disabled keeps /mj for relax",
			path:   "/mj/submit/imagine",
			mode:   setting.MjModeRelax,
			prefix: false,
			want:   "/mj/submit/imagine",
		},
		{
			name:   "query string is preserved",
			path:   "/mj/submit/imagine?foo=1",
			mode:   setting.MjModeRelax,
			prefix: true,
			want:   "/mj-relax/mj/submit/imagine?foo=1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setting.MjModePathPrefixEnabled = tt.prefix
			assert.Equal(t, tt.want, getMjRequestPath(tt.path, tt.mode))
		})
	}
}
