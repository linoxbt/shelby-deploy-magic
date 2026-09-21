FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* \
    && npm install -g --force pnpm@10.11.0 yarn@1.22.22 bun@1.2.15
COPY inspect.mjs /opt/shelby/inspect.mjs
COPY egress.mjs /opt/shelby/egress.mjs
WORKDIR /workspace
USER 1000:1000
