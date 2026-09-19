<div align="center" width="100%">
    <img src="./frontend/public/icon.svg" width="128" alt="Dockge" />
</div>

# Dockge — Lorwell Fork

[![Version](https://img.shields.io/badge/version-1.8.2-green.svg)](./package.json)
[![Docker pulls](https://img.shields.io/docker/pulls/moailaozi/dockge.svg)](https://hub.docker.com/r/moailaozi/dockge)
[![Build Docker image](https://github.com/Lorwell/dockge/actions/workflows/docker-image.yml/badge.svg)](https://github.com/Lorwell/dockge/actions/workflows/docker-image.yml)

This repository is an independently maintained fork of
[Dockge](https://github.com/louislam/dockge). It has its own Docker images, release workflow, documentation, and
upgrade path. Use this repository and the `moailaozi/dockge` image when installing or upgrading this fork.

Dockge is a responsive, self-hosted manager for Docker Compose stacks. Compose files remain ordinary files on the
host and can still be managed with the Docker Compose CLI.

## What is different in this fork

- Container instance details generated from the live Compose state, including stacks that use `include`
- Dedicated Overview, Logs, and Terminal views for each created container
- Large, viewport-aware log panels with follow, clear, copy, and in-page fullscreen controls
- Container-level start, stop, and restart actions with stack ownership validation
- Fully interactive Bash/sh terminals with Tab, control-key, resize, and paste support
- The original Compose editor, stack lifecycle controls, multi-agent support, and responsive UI

## Quick start

Requirements:

- Docker Engine 20+ with Docker Compose V2, or a compatible Podman installation
- A Linux host capable of mounting the Docker socket
- `amd64`, `arm64`, or `arm/v7`

Create the directories and save the following as `/opt/dockge/compose.yaml`:

```bash
mkdir -p /opt/dockge /opt/stacks
cd /opt/dockge
```

```yaml
services:
  dockge:
    image: docker.io/moailaozi/dockge:1.8.2
    restart: unless-stopped
    ports:
      - "5001:5001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data
      # The host and container paths must be identical.
      - /opt/stacks:/opt/stacks
    environment:
      - DOCKGE_STACKS_DIR=/opt/stacks
      # Set both values when stack files should be owned by a non-root user.
      - PUID=1000
      - PGID=1000
```

Start Dockge:

```bash
docker compose up -d
```

Open <http://localhost:5001>. For production, pin a full version such as `1.8.2`; the `latest` tag follows the
newest stable release of this fork.

## Stack directory and imports

The default stacks directory in the example is `/opt/stacks`. Each stack has its own directory and Compose file:

```text
/opt/stacks/
└── example-stack/
    └── compose.yaml
```

Existing Compose projects can also be represented with an include-only stack file:

```yaml
name: nginx-proxy-manager
include:
  - path: /data/nginx-proxy-manager/docker-compose.yaml
    project_directory: /data/nginx-proxy-manager
services: {}
```

After adding files outside the UI, use **Scan Stacks Folder** in Dockge. Paths referenced by Compose must be
available to the Dockge container at the same absolute path.

## Restricted file manager

The optional file manager is disabled unless a root directory is explicitly configured. In Docker, mount only
the directory that Dockge should be allowed to manage and set:

```yaml
volumes:
  - /host/managed-files:/managed-files
environment:
  - DOCKGE_FILE_MANAGER_ROOT=/managed-files
  - DOCKGE_FILE_MANAGER_MAX_FILE_SIZE=104857600
```

Each Dockge Agent has its own independent root. File operations cannot access parent directories or traverse
symbolic links outside the configured root.

## Upgrade

Back up `/opt/dockge/data` and the stack directory, update the pinned image version, then run:

```bash
cd /opt/dockge
docker compose pull
docker compose up -d
```

Database migrations run automatically at startup. Restore a pre-upgrade backup if a downgrade is required.

## Local development

Dockge requires Node.js 22.14 or newer. Install dependencies and start both development servers:

```bash
npm install
npm run dev
```

- Frontend: <http://localhost:5000>
- Backend: <http://localhost:5001>
- `npm run dev:frontend` and `npm run dev:backend` can be run separately.

Before submitting changes, run:

```bash
npm run lint
npm run check-ts
npm run build:frontend
```

## Docker image publishing

The `Build and push Docker image` GitHub Actions workflow publishes multi-platform images for `amd64`, `arm64`,
and `arm/v7`. It can only publish stable images from `master`, and derives the release version from `package.json`.
For version `1.8.2`, it publishes `1.8.2`, `1.8`, `1`, and `latest` tags.

Configure these GitHub Actions secrets before running the workflow:

- `DOCKER_HUB_USERNAME`: Docker Hub account name
- `DOCKER_HUB_TOKEN`: Docker Hub access token with permission to push `moailaozi/dockge`

Then open **Actions → Build and push Docker image → Run workflow** on the `master` branch.

## Support and contribution

- [Issues](https://github.com/Lorwell/dockge/issues)
- [Actions](https://github.com/Lorwell/dockge/actions)
- [Docker image tags](https://hub.docker.com/r/moailaozi/dockge/tags)
- [Development guidelines](./CONTRIBUTING.md)

This fork is maintained independently. Do not report fork-specific problems or request its features in the
upstream Dockge repository.

## Attribution

Dockge is licensed under the MIT License and builds on the work of Louis Lam and the upstream Dockge contributors.
