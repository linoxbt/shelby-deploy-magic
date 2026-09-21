#!/usr/bin/env sh
set -eu

go install github.com/caddyserver/xcaddy/cmd/xcaddy@v0.4.5
"$(go env GOPATH)/bin/xcaddy" build v2.10.2 \
  --with github.com/caddy-dns/netlify@c1477a09d3352242156e000f7e6abed9ffe60f72 \
  --output ./caddy
