#!/bin/sh
# Construit windows/VNL-SAD.exe (Windows 10/11, 64 bits). Nécessite Go 1.21 ou plus récent.
set -e
cd "$(dirname "$0")"
rm -rf www && mkdir -p www
for f in index.html manifest.webmanifest icon.svg sw.js css js vendor; do cp -r ../$f www/; done
[ -f go.mod ] || go mod init vnlsad >/dev/null 2>&1
if command -v go-winres >/dev/null 2>&1 && [ -f winres/winres.json ]; then go-winres make --arch amd64; fi
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o VNL-SAD.exe .
echo "windows/VNL-SAD.exe construit"
