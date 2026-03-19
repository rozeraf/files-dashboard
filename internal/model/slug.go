// internal/model/slug.go
package model

import (
	"regexp"
	"strings"
)

var (
	reBadChars = regexp.MustCompile(`[^a-z0-9\s-]`)
	reSpaces   = regexp.MustCompile(`[\s-]+`)
)

func Slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = reBadChars.ReplaceAllString(s, " ")
	s = reSpaces.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}
