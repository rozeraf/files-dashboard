// internal/config/config_test.go
package config_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/rozeraf/files-dashboard/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaults(t *testing.T) {
	dir := t.TempDir()
	cfg, err := config.Load(filepath.Join(dir, "config.json"))
	require.NoError(t, err)
	assert.Equal(t, "127.0.0.1", cfg.Host)
	assert.Equal(t, 4537, cfg.Port)
	assert.Equal(t, "files-dashboard", cfg.AppName)
	assert.Empty(t, cfg.Roots)
	assert.False(t, cfg.LanEnabled)
}

func TestPersist(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")

	cfg, _ := config.Load(path)
	cfg.AppName = "my-dashboard"
	require.NoError(t, cfg.Save())

	raw, _ := os.ReadFile(path)
	var m map[string]any
	json.Unmarshal(raw, &m)
	assert.Equal(t, "my-dashboard", m["app_name"])
}

func TestRootConfig(t *testing.T) {
	dir := t.TempDir()
	cfg, _ := config.Load(filepath.Join(dir, "config.json"))

	root := config.RootConfig{ID: "r1", Path: "/tmp", Label: "Temp"}
	cfg.Roots = append(cfg.Roots, root)
	cfg.Save()

	cfg2, err := config.Load(cfg.Path())
	require.NoError(t, err)
	require.Len(t, cfg2.Roots, 1)
	assert.Equal(t, "/tmp", cfg2.Roots[0].Path)
}
