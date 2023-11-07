<div align="center" width="100%">
    <img src="./frontend/public/icon.svg" width="128" alt="" />
</div>

# Dockge

A fancy, easy-to-use and reactive docker `compose.yaml` stack manager.

<img src="https://github.com/louislam/dockge/assets/1336778/26a583e1-ecb1-4a8d-aedf-76157d714ad7" width="900" alt="" />

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

1. Create a directory `dockge`
2. Create or download [`compose.yaml`](https://raw.githubusercontent.com/louislam/dockge/master/compose.yaml) and put it inside `dockge`:

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
3. `docker-compose up -d`

Dockge is now running on http://localhost:5001

## Motivations

- I have been using Portainer for some time, but for the stack management, I am sometimes not satisfied with it. For example, sometimes when I try to deploy a stack, the loading icon keeps spinning for a few minutes without progress. And sometimes error messages are not clear.
- Try to develop with ES Module + TypeScript (Originally, I planned to use Deno or Bun.js, but they do not support for arm64, so I stepped back to Node.js)

If you love this project, please consider giving this project a ⭐.


## FAQ

#### "Dockge"?

"Dockge" is a coinage word which is created by myself. I hope it sounds like `Badge` but replacing with `Dock` - `Dock-ge`.

The naming idea was coming from Twitch emotes like `sadge`, `bedge` or `wokege`. They are all ending with `-ge`.

If you are not comfortable with the pronunciation, you can call it `Dockage`

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


