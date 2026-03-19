// internal/config/config.go
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type RootConfig struct {
	ID    string `json:"id"`
	Path  string `json:"path"`
	Label string `json:"label"`
}

type Config struct {
	Host       string       `json:"host"`
	Port       int          `json:"port"`
	AppName    string       `json:"app_name"`
	Roots      []RootConfig `json:"roots"`
	LanEnabled bool         `json:"lan_enabled"`

	path string
	mu   sync.Mutex
}

func Load(path string) (*Config, error) {
	cfg := &Config{
		Host:    "127.0.0.1",
		Port:    4537,
		AppName: "files-dashboard",
		Roots:   []RootConfig{},
		path:    path,
	}

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return cfg, cfg.Save()
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	cfg.path = path
	return cfg, nil
}

func (c *Config) Path() string { return c.path }

func (c *Config) Save() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(c.path), 0750); err != nil {
		return err
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := c.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0640); err != nil {
		return err
	}
	return os.Rename(tmp, c.path)
}
