# Bockge

Bockge is a simple and reactive self-hosted manager for Docker Compose stacks.

Bockge is a fork of the original Dockge project by Louis Lam. This project is an alternative flavor focusing on a UX-friendly layout and Material Design 3 styling. It is not intended to be a replacement for the upstream Dockge project.

## Features

- Stack Management: Create, edit, start, stop, restart, and delete compose.yaml stacks.
- Interactive Editor: Edit your Docker Compose configurations directly in the browser.
- Web Terminal: Monitor container outputs and run commands via a web terminal.
- UX-Friendly Layout: Polished interface utilizing Material Design 3 styles that is responsive across devices.
- Docker Run Converter: Convert standard docker run commands into compose.yaml configurations.
- File-Safe: Bockge stores all compose files directly on your host filesystem so you can still use normal docker compose CLI commands.

## Installation

### Requirements
- Docker 20+ or Podman
- Linux (Ubuntu, Debian, CentOS, Fedora, Arch)

### Quick Start
By default, Bockge stores stacks in /opt/stacks and runs on port 5001.

```bash
mkdir -p /opt/stacks /opt/bockge
cd /opt/bockge
curl https://raw.githubusercontent.com/dsbok/dockge/master/compose.yaml --output compose.yaml
docker compose up -d
```
Access the dashboard at http://localhost:5001.

## Custom Configuration

If you want to customize your stack storage directory, edit the DOCKGE_STACKS_DIR environment variable and volumes inside compose.yaml:

```yaml
services:
  bockge:
    image: dsbok/dockge:latest
    restart: unless-stopped
    ports:
      - 5001:5001
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data
      - /opt/stacks:/opt/stacks
    environment:
      - DOCKGE_STACKS_DIR=/opt/stacks
```

## How to Update

```bash
cd /opt/bockge
docker compose pull && docker compose up -d
```
