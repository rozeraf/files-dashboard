# Makefile
.PHONY: run build dev-backend dev-frontend copy-frontend test test-race clean

BINARY        = bin/files-dashboard
FRONTEND_SRC  = web/dist
FRONTEND_DEST = internal/httpapi/static

# Production build: compile frontend, copy, embed, build binary
build: copy-frontend
	go build -ldflags="-s -w" -o $(BINARY) ./cmd/app

# Copy compiled frontend for embed
copy-frontend:
	cd web && bun run build
	rm -rf $(FRONTEND_DEST)
	mkdir -p $(FRONTEND_DEST)
	cp -r $(FRONTEND_SRC)/. $(FRONTEND_DEST)/

# Run the production binary
run: build
	./$(BINARY)

# Run backend only (for development alongside Vite)
dev-backend:
	go run ./cmd/app

# Run frontend dev server
dev-frontend:
	cd web && bun run dev

# Run all Go tests
test:
	go test ./... -v

# Run tests with race detector
test-race:
	go test -race ./...

# Clean build artifacts
clean:
	rm -rf $(BINARY) $(FRONTEND_DEST) web/dist
