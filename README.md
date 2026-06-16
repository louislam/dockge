<div align="center" width="100%">
    <img src="./frontend/public/icon.svg" width="128" alt="" />
</div>

# Dockge

A fancy, easy-to-use and reactive self-hosted docker compose.yaml stack-oriented manager.

[![GitHub Repo stars](https://img.shields.io/github/stars/NightWatcher314/dockge?logo=github&style=flat)](https://github.com/NightWatcher314/dockge) [![Docker Pulls](https://img.shields.io/badge/image-registry.ntwc.top%2Fnightwatcher314%2Fdockge-blue)](https://github.com/NightWatcher314/dockge) [![Docker Image Version (latest semver)](https://img.shields.io/badge/version-self--hosted-blue)](https://github.com/NightWatcher314/dockge) [![GitHub last commit (branch)](https://img.shields.io/github/last-commit/NightWatcher314/dockge/master?logo=github)](https://github.com/NightWatcher314/dockge/commits/master/)

<img src="https://github.com/louislam/dockge/assets/1336778/26a583e1-ecb1-4a8d-aedf-76157d714ad7" width="900" alt="" />

View Video: https://youtu.be/AWAlOQeNpgU?t=48

## ⭐ Features

- 🧑‍💼 Manage your `compose.yaml` files
  - Create/Edit/Start/Stop/Restart/Delete
  - Update Docker Images
- ⌨️ Interactive Editor for `compose.yaml`
- 🦦 Interactive Web Terminal
- 🕷️ (1.4.0 🆕) Multiple agents support - You can manage multiple stacks from different Docker hosts in one single interface
- 🏪 Convert `docker run ...` commands into `compose.yaml`
- 📙 File based structure - Dockge won't kidnap your compose files, they are stored on your drive as usual. You can interact with them using normal `docker compose` commands

<img src="https://github.com/louislam/dockge/assets/1336778/cc071864-592e-4909-b73a-343a57494002" width=300 />

- 🚄 Reactive - Everything is just responsive. Progress (Pull/Up/Down) and terminal output are in real-time
- 🐣 Easy-to-use & fancy UI - If you love Uptime Kuma's UI/UX, you will love this one too

![](https://github.com/louislam/dockge/assets/1336778/89fc1023-b069-42c0-a01c-918c495f1a6a)

## 🔧 How to Install

Requirements:
- [Docker](https://docs.docker.com/engine/install/) 20+ / Podman
- (Podman only) podman-docker (Debian: `apt install podman-docker`)
- OS:
  - Major Linux distros that can run Docker/Podman such as:
     - ✅ Ubuntu
     - ✅ Debian (Bullseye or newer)
     - ✅ Raspbian (Bullseye or newer)
     - ✅ CentOS
     - ✅ Fedora
     - ✅ ArchLinux
  - ❌ Debian/Raspbian Buster or lower is not supported
  - ❌ Windows (Will be supported later)
- Arch: armv7, arm64, amd64 (a.k.a x86_64)

### Basic

This fork is deployed from our own GitHub repository and container image.

- Repository: `https://github.com/NightWatcher314/dockge`
- Image: `registry.ntwc.top/nightwatcher314/dockge:1`
- Default Stacks Directory: `/opt/stacks`
- Default Port: 5001

```bash
# Create directories that store your stacks and Dockge's own stack
mkdir -p /opt/stacks /opt/dockge
cd /opt/dockge

# Download our compose.yaml
curl -L https://raw.githubusercontent.com/NightWatcher314/dockge/master/compose.yaml --output compose.yaml

# Start the server
docker compose up -d
```

Dockge is now running on http://localhost:5001

### Build From This Repository

Use this when you want to build the image yourself instead of only pulling
`registry.ntwc.top/nightwatcher314/dockge:1`. The release image depends on the
local base and healthcheck images, so build those first.

```bash
git clone https://github.com/NightWatcher314/dockge.git /opt/dockge
cd /opt/dockge

# Build helper images used by docker/Dockerfile
docker build -t registry.ntwc.top/nightwatcher314/dockge:build-healthcheck -f docker/BuildHealthCheck.Dockerfile .
docker build -t registry.ntwc.top/nightwatcher314/dockge:base -f docker/Base.Dockerfile .

# Build and start the Dockge service using the build override
docker compose -f compose.yaml -f compose.build.yaml build dockge
docker compose -f compose.yaml -f compose.build.yaml up -d dockge
```

To publish the built image to our registry after the compose build, run:

```bash
docker compose -f compose.yaml -f compose.build.yaml push dockge
```

If you are using docker-compose V1 or Podman, use the equivalent
`docker-compose ...` or `podman compose ...` commands.

### Advanced

If you want to store your stacks in another directory, edit `compose.yaml` and
change both the `DOCKGE_STACKS_DIR` environment variable and the stack-directory
volume mount. The host path and container path must match.

Once compose is edited, add the `PUID` and `PGID` section below to your compose
`environment:` section to set stack ownership, otherwise default is `root`

```
      # Both PUID and PGID must be set for it to do anything
      - PUID=1000 # Set the stack file/dir ownership to this user
      - PGID=1000 # Set the stack file/dir ownership to this group
```

Copy and paste your compose from the following:

compose:
```
services:
  dockge:
    image: registry.ntwc.top/nightwatcher314/dockge:1
    restart: unless-stopped
    ports:
      # Host Port:Container Port
      - 5001:5001
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data
        
      # If you want to use private registries, you need to share the auth file with Dockge:
      # - /root/.docker/:/root/.docker

      # Stacks Directory
      # Your stacks directory in the host (The paths inside container must be the same as the host)
      # ⚠️ If you did it wrong, your data could end up be written into a wrong path.
      # ✔️ CORRECT EXAMPLE: - /my-stacks:/my-stacks (Both paths match)
      # ❌ WRONG EXAMPLE: - /docker:/my-stacks (Both paths do not match)
      - /opt/stacks:/opt/stacks
    environment:
      # Tell Dockge where your stacks directory is
      - DOCKGE_STACKS_DIR=/opt/stacks
      # Both PUID and PGID must be set for it to do anything
      - PUID=1000 # Set the stack file/dir ownership to this user
      - PGID=1000 # Set the stack file/dir ownership to this group
```

## How to Update

```bash
cd /opt/dockge
docker compose pull && docker compose up -d
```

## Screenshots

![](https://github.com/louislam/dockge/assets/1336778/e7ff0222-af2e-405c-b533-4eab04791b40)


![](https://github.com/louislam/dockge/assets/1336778/7139e88c-77ed-4d45-96e3-00b66d36d871)

![](https://github.com/louislam/dockge/assets/1336778/f019944c-0e87-405b-a1b8-625b35de1eeb)

![](https://github.com/louislam/dockge/assets/1336778/a4478d23-b1c4-4991-8768-1a7cad3472e3)


## Motivations

- I have been using Portainer for some time, but for the stack management, I am sometimes not satisfied with it. For example, sometimes when I try to deploy a stack, the loading icon keeps spinning for a few minutes without progress. And sometimes error messages are not clear.
- Try to develop with ES Module + TypeScript

If you love this project, please consider giving it a ⭐.


## 🗣️ Community and Contribution

### Bug Report
https://github.com/NightWatcher314/dockge/issues

### Ask for Help / Discussions
https://github.com/NightWatcher314/dockge/discussions

### Translation
If you want to translate Dockge into your language, please read [Translation Guide](https://github.com/NightWatcher314/dockge/blob/master/frontend/src/lang/README.md)

### Create a Pull Request

Be sure to read the [guide](https://github.com/NightWatcher314/dockge/blob/master/CONTRIBUTING.md), as we don't accept all types of pull requests and don't want to waste your time.

## FAQ

#### "Dockge"?

"Dockge" is a coinage word which is created by myself. I originally hoped it sounds like `Dodge`, but apparently many people called it `Dockage`, it is also acceptable.

The naming idea came from Twitch emotes like `sadge`, `bedge` or `wokege`. They all end in `-ge`.

#### Can I manage a single container without `compose.yaml`?

The main objective of Dockge is to try to use the docker `compose.yaml` for everything. If you want to manage a single container, you can just use Portainer or Docker CLI.

#### Can I manage existing stacks?

Yes, you can. However, you need to move your compose file into the stacks directory:

1. Stop your stack
2. Move your compose file into `/opt/stacks/<stackName>/compose.yaml`
3. In Dockge, click the " Scan Stacks Folder" button in the top-right corner's dropdown menu
4. Now you should see your stack in the list

#### Is Dockge a Portainer replacement?

Yes or no. Portainer provides a lot of Docker features. While Dockge is currently only focusing on docker-compose with a better user interface and better user experience.

If you want to manage your container with docker-compose only, the answer may be yes.

If you still need to manage something like docker networks, single containers, the answer may be no.

#### Can I install both Dockge and Portainer?

Yes, you can.

## Others

Dockge is built on top of [Compose V2](https://docs.docker.com/compose/migrate/). `compose.yaml`  also known as `docker-compose.yml`.
