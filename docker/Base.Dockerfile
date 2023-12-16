# Due to the bug of #145, Node.js's version cannot be changed, unless upstream is fixed.
FROM node:18.17.1-bookworm-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"


# TARGETPLATFORM: linux/amd64, linux/arm64, linux/arm/v7
ARG TARGETPLATFORM

# TARGETARCH: amd64, arm64, arm/v7
ARG TARGETARCH

RUN apt update && apt install --yes --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    unzip \
    dumb-init \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo \
         "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
         "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
         tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt update \
    && apt --yes --no-install-recommends install \
         docker-ce-cli \
    && rm -rf /var/lib/apt/lists/* \
    && npm install pnpm -g \
    && pnpm install -g tsx

# Download docker-compose, as the repo's docker-compose is not up-to-date.
COPY ./extra/download-docker-compose.ts ./extra/download-docker-compose.ts
ARG DOCKER_COMPOSE_VERSION="2.23.3"
RUN tsx ./extra/download-docker-compose.ts ${TARGETPLATFORM} ${DOCKER_COMPOSE_VERSION} \
    && docker compose version
