############################################
# Healthcheck Binary
############################################
FROM louislam/dockge:build-healthcheck AS build_healthcheck

############################################
# Build frontend
############################################
FROM louislam/dockge:base AS build_frontend
WORKDIR /app
COPY --chown=node:node . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install && \
    pnpm run build:frontend

############################################
# Install node modules
############################################
FROM louislam/dockge:base AS build_nodemodules
WORKDIR /app
COPY --chown=node:node  ./package.json ./package.json
COPY --chown=node:node  ./pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

############################################
# ⭐ Main Image
############################################
FROM louislam/dockge:base AS release
WORKDIR /app
COPY --chown=node:node --from=build_healthcheck /app/extra/healthcheck /app/extra/healthcheck
COPY --from=build_frontend /app/frontend-dist /app/frontend-dist
COPY --from=build_nodemodules /app/node_modules /app/node_modules
COPY --chown=node:node . .
RUN mkdir ./data


# It is just for safe, as by default, it is disabled in the latest Node.js now.
# Read more:
# - https://github.com/sagemathinc/cocalc/issues/6963
# - https://github.com/microsoft/node-pty/issues/630#issuecomment-1987212447
ENV UV_USE_IO_URING=0

VOLUME /app/data
EXPOSE 5001
HEALTHCHECK --interval=60s --timeout=30s --start-period=60s --retries=5 CMD extra/healthcheck
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["bash", "-c", "node ./extra/clean-tsx-tmp.js && tsx ./backend/index.ts"]

############################################
# Mark as Nightly
############################################
FROM release AS nightly
RUN pnpm run mark-as-nightly
