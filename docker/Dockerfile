############################################
# Build
############################################
FROM louislam/dockge:base AS build
WORKDIR /app
COPY --chown=node:node  ./package.json ./package.json
COPY --chown=node:node  ./pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

############################################
# ⭐ Main Image
############################################
FROM louislam/dockge:base AS release
WORKDIR /app
COPY --chown=node:node  . .
COPY --from=build /app/node_modules /app/node_modules
RUN mkdir ./data

VOLUME /app/data
EXPOSE 5001
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["tsx", "./backend/index.ts"]


############################################
# Mark as Nightly
############################################
FROM release AS nightly
RUN pnpm run mark-as-nightly
