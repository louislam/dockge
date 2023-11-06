<div align="center" width="100%">
    <img src="./frontend/public/icon.svg" width="128" alt="" />
</div>

# Dockge

A fancy, easy-to-use and reactive docker `compose.yaml` stack manager.

Dockge is built on top of [Compose V2](https://docs.docker.com/compose/migrate/). `compose.yaml`  is as known as `docker-compose.yml`.

## ⭐ Features

- Focus on `compose.yaml` stack management
- Interactive editor for `compose.yaml`
- Interactive web terminal for containers and docker commands
- Reactive
   - Everything is just responsive. Progress and terminal output are in real-time
- Easy-to-use & fancy UI
   - If you love Uptime Kuma's UI/UX, you will love this too
- Convert `docker run ...` command into `compose.yaml` file

## 🔧 How to Install

1. Create a directory `./dockge/`
1. Create a `compose.yaml` file inside `./dockge` with the following content:

```yaml
version: "3.8"
services:
  dockge:
    image: louislam/dockge:nightly
    ports:
      - 5001:5001
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
```

2. `cd ./dockge/`
3. `docker-compose up -d`

Dockge is now running on http://localhost:5001

## Motivations

- I have been using Portainer for some time, but for the stack management, I am sometimes not satisfied with it. For example, sometimes when I try to deploy a stack, the loading icon keeps spinning for a few minutes without progress. And sometimes error messages are not clear.
- Try to develop with ES Module + TypeScript (Originally, I planned to use Deno or Bun.js, but they do not support for arm64, so I stepped back to Node.js)

If you love this project, please consider giving this project a ⭐.




## More Ideas?

- Stats
- File manager
- App store for yaml templates
- Get app icons
- Switch Docker context
- Support Dockerfile and build
- Support Docker swarm


