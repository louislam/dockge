<div align="center" width="100%">
    <img src="./frontend/public/icon.svg" width="128" alt="" />
</div>

# Dockge

A fancy, easy-to-use and reactive docker `compose.yaml` stack-oriented manager.

<img src="https://github.com/louislam/dockge/assets/1336778/26a583e1-ecb1-4a8d-aedf-76157d714ad7" width="900" alt="" />

[View Video](https://youtu.be/AWAlOQeNpgU)

## ⭐ Features

- Manage `compose.yaml`
- Interactive Editor for `compose.yaml`
- Interactive Web Terminal
- Reactive
   - Everything is just responsive. Progress (Pull/Up/Down) and terminal output are in real-time
- Easy-to-use & fancy UI
   - If you love Uptime Kuma's UI/UX, you will love this too
- Convert `docker run ...` commands into `compose.yaml`

## 🔧 How to Install

Requirements:
- [Docker CE](https://docs.docker.com/engine/install/) 20+ is recommended
- [Docker Compose V2](https://docs.docker.com/compose/install/linux/)
- OS: 
  - As long as you can run Docker CE, it should be fine, but:
  - Debian/Raspbian Buster or lower is not supported, please upgrade to Bullseye
- Arch: armv7, arm64, amd64 (a.k.a x86_64)

### Basic

Default stacks directory is `/opt/stacks`.

```
# Create a directory that stores your stacks and stores dockge's compose.yaml
mkdir -p /opt/stacks /opt/dockge
cd /opt/dockge

# Download the compose.yaml
curl https://raw.githubusercontent.com/louislam/dockge/master/compose.yaml --output compose.yaml

# Start Server
docker compose up -d

# If you are using docker-compose V1
# docker-compose up -d 
```

### Advanced

If you want to store your stacks in another directory, you can change the `DOCKGE_STACKS_DIR` environment variable and volumes.

For example, if you want to store your stacks in `/my-stacks`:

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

      # Your stacks directory in the host
      # (The paths inside container must be the same as the host)
      - /my-stacks:/my-stacks
    environment:
      # Tell Dockge where is your stacks directory
      - DOCKGE_STACKS_DIR=/my-stacks
```

## How to Update

```bash
cd /opt/stacks
docker compose pull
docker compose up -d
```

## Screenshots

![](https://github.com/louislam/dockge/assets/1336778/7139e88c-77ed-4d45-96e3-00b66d36d871)

![](https://github.com/louislam/dockge/assets/1336778/f019944c-0e87-405b-a1b8-625b35de1eeb)

![](https://github.com/louislam/dockge/assets/1336778/a4478d23-b1c4-4991-8768-1a7cad3472e3)


## Motivations

- I have been using Portainer for some time, but for the stack management, I am sometimes not satisfied with it. For example, sometimes when I try to deploy a stack, the loading icon keeps spinning for a few minutes without progress. And sometimes error messages are not clear.
- Try to develop with ES Module + TypeScript (Originally, I planned to use Deno or Bun.js, but they do not support for arm64, so I stepped back to Node.js)

If you love this project, please consider giving this project a ⭐.


## FAQ

#### "Dockge"?

"Dockge" is a coinage word which is created by myself. I hope it sounds like `Badge` but replacing with `Dock` - `Dock-ge`.

The naming idea was coming from Twitch emotes like `sadge`, `bedge` or `wokege`. They are all ending with `-ge`.

If you are not comfortable with the pronunciation, you can call it `Dockage`

#### Can I manage a single container without `compose.yaml`?

The main objective of Dockge is that try to use docker `compose.yaml` for everything. If you want to manage a single container, you can just use Portainer or Docker CLI.

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

Dockge is built on top of [Compose V2](https://docs.docker.com/compose/migrate/). `compose.yaml`  is also known as `docker-compose.yml`.


