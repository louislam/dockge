FROM debian:bookworm-slim

COPY --from=docker:dind /usr/local/bin/docker /usr/local/bin/

RUN apt update && apt install --yes --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*
RUN curl https://bun.sh/install | bash -s "bun-v1.0.3"

WORKDIR /app

COPY . .
RUN bun install --production --frozen-lockfile
