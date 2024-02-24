# Due to the bug of #145, Node.js's version cannot be changed, unless upstream is fixed.
# TODO: use proper devcontainer??
FROM node:18.17.1-bookworm

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV="development"
RUN apt update && apt install --yes --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    unzip \
    dumb-init \
    sqlite3 \
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
         docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/* \
    && npm install pnpm -g \
    && pnpm install -g tsx 

# Set the working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml to the working directory
COPY --chown=node:node  ./package.json ./package.json
COPY --chown=node:node  ./pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install

# Add the "node_modules" volume to enable caching
VOLUME [ "/app/node_modules" ]
VOLUME [ "/opt/stacks" ]

# Start the container with a shell by default
CMD [ "/bin/bash" ]