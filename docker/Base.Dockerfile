FROM debian:bookworm-slim

COPY --from=docker:dind /usr/local/bin/docker /usr/local/bin/

RUN apt update && apt install --yes --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*
RUN curl https://bun.sh/install | bash -s "bun-v1.0.3"


# Full Base Image
# MariaDB, Chromium and fonts
FROM base-slim AS base
ENV DOCKGE_ENABLE_EMBEDDED_MARIADB=1
RUN apt update && \
    apt --yes --no-install-recommends install mariadb-server && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove
