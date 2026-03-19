# Makefile
.PHONY: run build copy-frontend test

BINARY = bin/files-dashboard
FRONTEND_SRC = web/dist
FRONTEND_DEST = internal/httpapi/static

run: build
	./$(BINARY)

build: copy-frontend
	go build -o $(BINARY) ./cmd/app

copy-frontend:
	rm -rf $(FRONTEND_DEST)
	mkdir -p $(FRONTEND_DEST)
	cp -r $(FRONTEND_SRC)/. $(FRONTEND_DEST)/

dev-backend:
	go run ./cmd/app

test:
	go test ./...
