For NPM:

&#x20; services:

&#x20;  nginx-proxy-manager:

&#x20;   image: .jc21/nginx-proxy-manager:latest

&#x20;   restart: unless-stopped

&#x20;   ports:

&#x20;     - 80:80

&#x20;     -  81:81

&#x20;     - 443:443

&#x20; networks: {}





NPM container fix, compose.yaml:

services:

&#x20; nginx-proxy-manager:

&#x20;   image: jc21/nginx-proxy-manager:latest

&#x20;   restart: unless-stopped

&#x20;   ports:

&#x20;     - 80:80

&#x20;     - 81:81

&#x20;     - 443:443

&#x20;   volumes:

&#x20;     - /opt/stacks/npm/data:/data

&#x20;     - /opt/stacks/npm/letsencrypt:/etc/letsencrypt

networks: {}





&#x20;# musst add volumes e.g. ./data/npm/config:/config, without can couse error

&#x20; 

Added volumes for persistent storage: /config and /etc/letsencrypt.

Users must create host folders before starting the container:

mkdir -p ./data/npm/config ./data/npm/letsencrypt

Ensures DB, settings, and SSL certificates survive container/VM restarts

