# Due to the bug of #145, Node.js's version cannot be changed, unless upstream is fixed.
FROM node:18.17.1-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Prevent segmentation faults on ARM architectures
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Install basic dependencies
RUN apt-get update && apt-get install --no-install-recommends -y \
    ca-certificates \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Add Docker's official GPG key and repository
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo \
        "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
        "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install remaining packages
RUN apt-get update && apt-get install --no-install-recommends -y \
    build-essential \
    docker-ce-cli \
    docker-compose-plugin \
    dumb-init \
    python3-full \
    python3-pip \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js global packages with specific versions for better compatibility
RUN npm install -g pnpm@8.6.12 && \
    ESBUILD_BINARY_PATH=/usr/local/bin/esbuild pnpm install -g tsx@3.12.7
