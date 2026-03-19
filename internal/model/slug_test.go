// internal/model/slug_test.go
package model_test

import (
	"testing"

	"github.com/rozeraf/files-dashboard/internal/model"
	"github.com/stretchr/testify/assert"
)

func TestSlugify(t *testing.T) {
	cases := [][2]string{
		{"My Videos", "my-videos"},
		{"  Hello  World  ", "hello-world"},
		{"C++ Files & More!", "c-files-more"},
		{"already-slug", "already-slug"},
	}
	for _, c := range cases {
		assert.Equal(t, c[1], model.Slugify(c[0]), "input: %q", c[0])
	}
}
