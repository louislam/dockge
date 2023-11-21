<div align="center" width="100%">
    <img src="./frontend/public/icon.svg" width="128" alt="" />
</div>

# Dockge

A fancy, easy-to-use and reactive self-hosted docker compose.yaml stack-oriented manager.

![GitHub Repo stars](https://img.shields.io/github/stars/louislam/dockge?logo=github) ![GitHub issues](https://img.shields.io/github/issues/louislam/dockge?logo=github) ![GitHub pull requests](https://img.shields.io/github/issues-pr/louislam/dockge?logo=github) ![Docker Pulls](https://img.shields.io/docker/pulls/louislam/dockge?logo=docker) ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/louislam/dockge/latest?label=docker%20image%20ver.) ![GitHub last commit (branch)](https://img.shields.io/github/last-commit/louislam/dockge/master?logo=github) ![GitHub](https://img.shields.io/github/license/louislam/dockge?logo=github)

<img src="https://github.com/louislam/dockge/assets/1336778/26a583e1-ecb1-4a8d-aedf-76157d714ad7" width="900" alt="" />

View Video: https://youtu.be/AWAlOQeNpgU?t=48

## ⭐ Features

- Manage `compose.yaml`
  - Create/Edit/Start/Stop/Restart/Delete
  - Update Docker Images
- Interactive Editor for `compose.yaml`
- Interactive Web Terminal
- Reactive
   - Everything is just responsive. Progress (Pull/Up/Down) and terminal output are in real-time
- Easy-to-use & fancy UI
   - If you love Uptime Kuma's UI/UX, you will love this one too
- Convert `docker run ...` commands into `compose.yaml`
- File based structure
   - Dockge won't kidnap your compose files, they are stored on your drive as usual. You can interact with them using normal `docker compose` commands
   <img src="https://github.com/louislam/dockge/assets/1336778/cc071864-592e-4909-b73a-343a57494002" width=300 />


![](https://github.com/louislam/dockge/assets/1336778/89fc1023-b069-42c0-a01c-918c495f1a6a)

## 🔧 How to Install

Requirements:
- [Docker CE](https://docs.docker.com/engine/install/) 20+ is recommended / Podman
- (Docker only) [Docker Compose Plugin](https://docs.docker.com/compose/install/linux/)
- (Podman only) podman-docker (Debian: `apt install podman-docker`)
- OS:
  - As long as you can run Docker CE / Podman, it should be fine, but:
  - Debian/Raspbian Buster or lower is not supported, please upgrade to Bullseye or higher
- Arch: armv7, arm64, amd64 (a.k.a x86_64)

### Basic

- Default Stacks Directory: `/opt/stacks`
- Default Port: 5001

```
# Create a directory that stores your stacks and stores dockge's compose.yaml
mkdir -p /opt/stacks /opt/dockge
cd /opt/dockge

# Download the compose.yaml
curl https://raw.githubusercontent.com/louislam/dockge/master/compose.yaml --output compose.yaml

# Start the Server
docker compose up -d

# If you are using docker-compose V1 or Podman
# docker-compose up -d
```

Dockge is now running on http://localhost:5001

### Advanced

If you want to store your stacks in another directory, you can change the `DOCKGE_STACKS_DIR` environment variable and volumes.

```yaml
version: "3.8"
services:
  dockge:
    image: louislam/dockge:1
    restart: unless-stopped
    ports:
      # Host Port:Container Port
      - 5001:5001
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data

      # If you want to use private registries, you need to share the auth file with Dockge:
      # - /root/.docker/:/root/.docker

      # Your stacks directory in the host (The paths inside container must be the same as the host)
      # ⚠️⚠️ If you did it wrong, your data could end up be written into a wrong path.
      # ✔️✔️✔️✔️ CORRECT EXAMPLE: - /my-stacks:/my-stacks (Both paths match)
      # ❌❌❌❌ WRONG EXAMPLE: - /docker:/my-stacks (Both paths do not match)
      - /opt/stacks:/opt/stacks
    environment:
      # Tell Dockge where is your stacks directory
      - DOCKGE_STACKS_DIR=/opt/stacks
```

## How to Update

```bash
cd /opt/dockge
docker compose pull
docker compose up -d
```

## Screenshots

![](https://github.com/louislam/dockge/assets/1336778/e7ff0222-af2e-405c-b533-4eab04791b40)


![](https://github.com/louislam/dockge/assets/1336778/7139e88c-77ed-4d45-96e3-00b66d36d871)

![](https://github.com/louislam/dockge/assets/1336778/f019944c-0e87-405b-a1b8-625b35de1eeb)

![](https://github.com/louislam/dockge/assets/1336778/a4478d23-b1c4-4991-8768-1a7cad3472e3)


## Motivations

- I have been using Portainer for some time, but for the stack management, I am sometimes not satisfied with it. For example, sometimes when I try to deploy a stack, the loading icon keeps spinning for a few minutes without progress. And sometimes error messages are not clear.
- Try to develop with ES Module + TypeScript (Originally, I planned to use Deno or Bun.js, but they don't have support for arm64, so I stepped back to Node.js)

If you love this project, please consider giving it a ⭐.


## 🗣️

### Bug Report
https://github.com/louislam/dockge/issues

### Ask for Help / Discussions
https://github.com/louislam/dockge/discussions

## Translation

If you want to translate Dockge into your language, please read [Translation Guide](https://github.com/louislam/dockge/blob/master/frontend/src/lang/README.md)

## FAQ

#### "Dockge"?

"Dockge" is a coinage word which is created by myself. I hope it sounds like `Dodge`.

The naming idea came from Twitch emotes like `sadge`, `bedge` or `wokege`. They all end in `-ge`.

#### Can I manage a single container without `compose.yaml`?

The main objective of Dockge is to try to use the docker `compose.yaml` for everything. If you want to manage a single container, you can just use Portainer or Docker CLI.

#### Can I manage existing stacks?

Yes, you can. However, you need to move your compose file into the stacks directory:

1. Stop your stack
2. Move your compose file into `/opt/stacks/<stackName>/compose.yaml`
3. In Dockge, click the " Scan Stacks Folder" button in the top-right corner's dropdown menu
4. Now you should see your stack in the list

## More Ideas?

- Stats
- File manager
- App store for yaml templates
- Get app icons
- Switch Docker context
- Support Dockerfile and build
- Support Docker swarm


# Others

Dockge is built on top of [Compose V2](https://docs.docker.com/compose/migrate/). `compose.yaml`  also known as `docker-compose.yml`.
