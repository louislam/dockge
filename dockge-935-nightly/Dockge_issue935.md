# Nightly and Stable Testing Report Problem Issue #935 – solved 

## Environment / Setup

- Host: Remote server (private)
- Hypervisor: Proxmox
- VM: Ubuntu Server
- Docker Compose: v2.40.3
- Browser: Chrome
- Access: SSH from local Windows machine (VS Code)

Inside VM:
Proxmox → Ubuntu VM → Docker → Dockge container

## Tests docker env.

- Stable test:
  - Docker version: 29.0.1
  - Dockge: stable/nightly (before update)

- Nightly test (reproduced twice):
  - Docker version: 29.4.0
  - Dockge: latest nightly

---

## 1. Stable Version Test

Image:
- `louislam/dockge:1`

Result:
- All containers running correctly
- GUI accessible in browser
- All 4 stacks deployed successfully

Stacks tested:
- Uptime Kuma
- Nginx Proxy Manager
- Caddy
- Nginx

Result: ✔ Stable version works without issues

---

## 2. Nightly Version Test

Image:
- `louislam/dockge:nightly`

Initial issue:
- Missing `data/db-config.json` (ENOENT warning)
- Dockge is trying to access the Docker daemon via /var/run/docker.sock, but it has no access inside the container.
- Docker socket access failure
This site can’t be reached IP took to long to responds
http://<IP_VM>:5001
The port is only reachable within the VM.

stderr: 'failed to connect to the docker API at unix:///var/run/docker.sock; 
---

## 3. Problems Identified

### 3.1 Data directory issue
Error:
- ENOENT: no such file or directory, open data/db-config.json`

docker logs -f simi-dockge-nightly-1 
2026-04-09T11:16:13Z [SERVER] INFO: Welcome to dockge! 
2026-04-09T11:16:13Z [SERVER] INFO: NODE_ENV: production 
2026-04-09T11:16:13Z [SERVER] INFO: Server Type: HTTP 
2026-04-09T11:16:13Z [SERVER] INFO: Data Dir: ./data/ 
2026-04-09T11:16:13Z [DB] WARN: ENOENT: no such file or directory, 
open 'data/db-config.json' 
2026-04-09T11:16:13Z [DB] INFO: Database Type: sqlite 
2026-04-09T11:16:13Z [SERVER] INFO: Connected to the database 
2026-04-09T11:16:13Z [SERVER] INFO: JWT secret is not found, generate one. 
2026-04-09T11:16:13Z [SERVER] INFO: Stored JWT secret into database 
2026-04-09T11:16:13Z [SERVER] INFO: No user, need setup 
2026-04-09T11:16:13Z [SERVER] INFO: Listening on 5001

Cause:
- Missing `/app/data` mount or missing host folder
The app starts before data/db-config.json exists → missing initialization step (race condition / missing bootstrap /init storage -volume problem, not sure but it works with this fix).

Fix:
solved by creating empty files db-config.json in opt/dockge/data
Mount volume + create empty file:
-v dockge-data:/app/data + touch data/db-config.json

mkdir -p ./data
chmod 777 ./data

in Gui it is also possible: 
For NPM:
  services:
   nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:latest
    restart: unless-stopped
    ports:
      - 80:80
      -  81:81
      - 443:443      
  networks: {}

 # musst add volumes e.g. ./data/npm/config:/config, without can couse error
 By first start is data/db-config.json missing Log: ENOENT  warning After Dockge use the db-config.json it is not an error.

Result:
✔ Nightly creates DB and JWT automatically on first run

3.2 Docker socket issue (critical)

Error:

failed to connect to the Docker API at unix:///var/run/docker.sock

Cause:

Docker socket not mounted into container

Fix:

-v /var/run/docker.sock:/var/run/docker.sock

Result:
✔ Dockge can now communicate with Docker daemon

4. Final Working Compose (Nightly)
services:
  dockge:
    image: louislam/dockge:nightly
    restart: unless-stopped
    ports:
      - 5001:5001
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /opt/dockge/data:/app/data
      - /opt/stacks:/opt/stacks
    environment:
      - DOCKGE_STACKS_DIR=/opt/stacks

5. Containers tested
Uptime Kuma: louislam/uptime-kuma:1
Nginx Proxy Manager: jc21/nginx-proxy-manager:latest
Caddy: caddy:latest
Nginx: nginx:latest

All running successfully with persistent volumes. There is only one small note for NPM, if u clic in GUI on the port (there are 2 ports: 80 and 81 ) it may try to open port 80 by default. However, the admin interface actually runs on port 81. 
So you need to access it manually via: http://IP-VM:81

6. Socket behavior observation
docker.socket can start automatically via systemd
Dockge requires active Docker daemon OR correct socket binding
Without socket mount → GUI works partially, but backend fails

7. Conclusion
Stable version: fully functional
Nightly version: functional after fixes
Root cause: missing Docker socket + missing data directory

After fixes:
✔ GUI works
✔ Containers managed correctly
✔ No ENOENT or socket errors

