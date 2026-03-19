// internal/fsops/fsops.go
package fsops

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rozeraf/files-dashboard/internal/model"
)

var ErrOutsideRoot = errors.New("path escapes root boundary")

// SafeJoin joins root with relPath and verifies the result stays inside root.
func SafeJoin(root, relPath string) (string, error) {
	joined := filepath.Clean(filepath.Join(root, relPath))
	if !strings.HasPrefix(joined+string(filepath.Separator), root+string(filepath.Separator)) {
		return "", ErrOutsideRoot
	}
	return joined, nil
}

// ListDir returns one-level-deep entries within root at relPath.
func ListDir(root, relPath string) ([]model.Entry, error) {
	dir, err := SafeJoin(root, relPath)
	if err != nil {
		return nil, err
	}
	des, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	entries := make([]model.Entry, 0, len(des))
	for _, de := range des {
		info, err := de.Info()
		if err != nil {
			continue
		}
		e := entryFromInfo(root, relPath, de.Name(), info)
		entries = append(entries, e)
	}
	return entries, nil
}

func entryFromInfo(root, parentRelPath, name string, info os.FileInfo) model.Entry {
	relPath := filepath.Join(parentRelPath, name)
	ext := ""
	mimeType := ""
	if !info.IsDir() {
		ext = strings.TrimPrefix(filepath.Ext(name), ".")
		// detect mime from first 512 bytes
		if f, err := os.Open(filepath.Join(root, relPath)); err == nil {
			buf := make([]byte, 512)
			n, _ := f.Read(buf)
			f.Close()
			mimeType = http.DetectContentType(buf[:n])
		}
		if mimeType == "" {
			mimeType = mime.TypeByExtension("." + ext)
		}
	}
	kind := "file"
	if info.IsDir() {
		kind = "dir"
	}
	var size *int64
	if !info.IsDir() {
		s := info.Size()
		size = &s
	}
	return model.Entry{
		RelPath:       relPath,
		ParentRelPath: parentRelPath,
		Name:          name,
		Kind:          kind,
		Size:          size,
		Mtime:         info.ModTime().Unix(),
		Ext:           ext,
		Mime:          mimeType,
		UpdatedAt:     time.Now().Unix(),
	}
}

func Mkdir(root, relPath string) error {
	target, err := SafeJoin(root, relPath)
	if err != nil {
		return err
	}
	return os.MkdirAll(target, 0755)
}

func Rename(root, relPath, newName string) error {
	if strings.Contains(newName, string(filepath.Separator)) {
		return fmt.Errorf("name must not contain path separators")
	}
	src, err := SafeJoin(root, relPath)
	if err != nil {
		return err
	}
	dst, err := SafeJoin(root, filepath.Join(filepath.Dir(relPath), newName))
	if err != nil {
		return err
	}
	return os.Rename(src, dst)
}

func Move(srcRoot, srcRelPath, dstRoot, dstRelPath string) error {
	src, err := SafeJoin(srcRoot, srcRelPath)
	if err != nil {
		return err
	}
	dst, err := SafeJoin(dstRoot, filepath.Join(dstRelPath, filepath.Base(srcRelPath)))
	if err != nil {
		return err
	}
	return os.Rename(src, dst)
}

func Delete(root, relPath string) error {
	target, err := SafeJoin(root, relPath)
	if err != nil {
		return err
	}
	return os.RemoveAll(target)
}

// SaveUpload writes an uploaded reader to dstRoot/dstRelPath/filename.
// Returns the rel_path of the created file.
func SaveUpload(dstRoot, dstRelPath, filename string, src io.Reader) (string, error) {
	dir, err := SafeJoin(dstRoot, dstRelPath)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	filePath := filepath.Join(dir, filepath.Base(filename))
	f, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, src); err != nil {
		return "", err
	}
	return filepath.Join(dstRelPath, filepath.Base(filename)), nil
}

// WalkRoot recursively walks root and returns all entries.
func WalkRoot(root string) ([]model.Entry, error) {
	var entries []model.Entry
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		rel, _ := filepath.Rel(root, path)
		if rel == "." {
			return nil
		}
		parent := filepath.Dir(rel)
		if parent == "." {
			parent = ""
		}
		e := entryFromInfo(root, parent, info.Name(), info)
		e.RelPath = rel
		entries = append(entries, e)
		return nil
	})
	return entries, err
}
