// internal/fsops/fsops_test.go
package fsops_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/rozeraf/files-dashboard/internal/fsops"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestContainedPath(t *testing.T) {
	root := t.TempDir()

	// valid paths
	p, err := fsops.SafeJoin(root, "subdir/file.txt")
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(root, "subdir", "file.txt"), p)

	// traversal attack
	_, err = fsops.SafeJoin(root, "../outside.txt")
	assert.Error(t, err)

	// double-dot in middle
	_, err = fsops.SafeJoin(root, "a/../../outside.txt")
	assert.Error(t, err)
}

func TestListDir(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "a.txt"), []byte("a"), 0644)
	os.Mkdir(filepath.Join(root, "sub"), 0755)
	os.WriteFile(filepath.Join(root, "sub", "b.txt"), []byte("b"), 0644)

	entries, err := fsops.ListDir(root, "")
	require.NoError(t, err)
	assert.Len(t, entries, 2) // a.txt + sub (one level only)
}

func TestMkdir(t *testing.T) {
	root := t.TempDir()
	err := fsops.Mkdir(root, "newdir")
	require.NoError(t, err)
	info, err := os.Stat(filepath.Join(root, "newdir"))
	require.NoError(t, err)
	assert.True(t, info.IsDir())
}

func TestRename(t *testing.T) {
	root := t.TempDir()
	src := filepath.Join(root, "old.txt")
	os.WriteFile(src, []byte("x"), 0644)

	err := fsops.Rename(root, "old.txt", "new.txt")
	require.NoError(t, err)
	_, err = os.Stat(filepath.Join(root, "new.txt"))
	assert.NoError(t, err)
}
