############################################
# ⭐ Main Image
############################################
FROM louislam/dockge:base
WORKDIR /app
COPY --chown=node:node  . .
RUN pnpm install --prod --frozen-lockfile && \
    mkdir ./data \
VOLUME /app/data
EXPOSE 5001
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["tsx", "./backend/index.ts"]


############################################
# Mark as Nightly
############################################
FROM release AS nightly
RUN pnpm run mark-as-nightly
