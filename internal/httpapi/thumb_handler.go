// internal/httpapi/thumb_handler.go
package httpapi

import (
	"image"
	"image/jpeg"
	_ "image/gif"
	_ "image/png"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rozeraf/files-dashboard/internal/index"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

func (h *Handler) thumbEntry(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	maxW := 400
	if wStr := r.URL.Query().Get("w"); wStr != "" {
		if v, err := strconv.Atoi(wStr); err == nil && v > 0 && v <= 2000 {
			maxW = v
		}
	}

	absPath, err := index.EntryAbsPath(h.db, id)
	if err != nil {
		writeError(w, 404, "not found")
		return
	}

	cacheDir := filepath.Join(h.dataDir, "thumbs")
	cachePath := filepath.Join(cacheDir, id+"_"+strconv.Itoa(maxW)+".jpg")

	if _, statErr := os.Stat(cachePath); statErr == nil {
		w.Header().Set("Cache-Control", "public, max-age=604800")
		http.ServeFile(w, r, cachePath)
		return
	}

	if genErr := generateThumb(absPath, cachePath, maxW); genErr != nil {
		// Unsupported format or decode error — fall back to raw file
		w.Header().Set("Cache-Control", "private, max-age=3600")
		http.ServeFile(w, r, absPath)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=604800")
	http.ServeFile(w, r, cachePath)
}

func generateThumb(srcPath, dstPath string, maxW int) error {
	f, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer f.Close()

	src, _, err := image.Decode(f)
	if err != nil {
		return err
	}

	bounds := src.Bounds()
	srcW, srcH := bounds.Dx(), bounds.Dy()

	thumbW := srcW
	thumbH := srcH
	if srcW > maxW {
		thumbW = maxW
		thumbH = srcH * maxW / srcW
	}

	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return err
	}

	dst := image.NewRGBA(image.Rect(0, 0, thumbW, thumbH))
	draw.BiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)

	out, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer out.Close()

	return jpeg.Encode(out, dst, &jpeg.Options{Quality: 82})
}
