############################################
# Build in Golang
############################################
FROM golang:1.21.4-bookworm
WORKDIR /app
ARG TARGETPLATFORM
COPY ./extra/healthcheck.go ./extra/healthcheck.go

# Compile healthcheck.go
RUN go build -x -o ./extra/healthcheck ./extra/healthcheck.go
