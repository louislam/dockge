import { DockgeSocket } from "./util-server";
import { io, Socket as SocketClient } from "socket.io-client";
import { log } from "./log";

/**
 * Dockge Instance Manager
 */
export class DockgeInstanceManager {

    protected socket : DockgeSocket;
    protected instanceSocketList : Record<string, SocketClient> = {};

    constructor(socket: DockgeSocket) {
        this.socket = socket;
    }

    connect(endpoint : string, tls : boolean, username : string, password : string) {
        if (this.instanceSocketList[endpoint]) {
            log.debug("INSTANCEMANAGER", "Already connected to the socket server: " + endpoint);
            return;
        }

        let url = ((tls) ? "wss://" : "ws://") + endpoint;

        log.info("INSTANCEMANAGER", "Connecting to the socket server: " + endpoint);
        let client = io(url, {
            transports: [ "websocket", "polling" ],
            extraHeaders: {
                endpoint,
            }
        });

        client.on("connect", () => {
            log.info("INSTANCEMANAGER", "Connected to the socket server: " + endpoint);

            client.emit("login", {
                username: username,
                password: password,
            }, (res) => {
                if (res.ok) {
                    log.info("INSTANCEMANAGER", "Logged in to the socket server: " + endpoint);
                } else {
                    log.error("INSTANCEMANAGER", "Failed to login to the socket server: " + endpoint);
                }
            });
        });

        client.on("error", (err) => {
            log.error("INSTANCEMANAGER", "Error from the socket server: " + endpoint);
            log.error("INSTANCEMANAGER", err);
        });

        client.on("disconnect", () => {
            log.info("INSTANCEMANAGER", "Disconnected from the socket server: " + endpoint);
        });

        client.on("agent", (...args : unknown[]) => {
            log.debug("INSTANCEMANAGER", "Forward event");
            this.socket.emit("agent", ...args);
        });

        this.instanceSocketList[endpoint] = client;
    }

    disconnect(endpoint : string) {
        let client = this.instanceSocketList[endpoint];
        client?.disconnect();
    }

    connectAll() {
        if (this.socket.endpoint) {
            log.info("INSTANCEMANAGER", "This connection is connected as an agent, skip connectAll()");
            return;
        }

        let list : Record<string, {tls : boolean, username : string, password : string}> = {

        };

        if (process.env.DOCKGE_TEST_REMOTE_HOST) {
            list[process.env.DOCKGE_TEST_REMOTE_HOST] = {
                tls: false,
                username: "admin",
                password: process.env.DOCKGE_TEST_REMOTE_PW || "",
            };
        }

        if (Object.keys(list).length !== 0) {
            log.info("INSTANCEMANAGER", "Connecting to all instance socket server(s)...");
        }

        for (let endpoint in list) {
            let item = list[endpoint];
            this.connect(endpoint, item.tls, item.username, item.password);
        }
    }

    disconnectAll() {
        for (let endpoint in this.instanceSocketList) {
            this.disconnect(endpoint);
        }
    }

    emitToEndpoint(endpoint: string, eventName: string, ...args : unknown[]) {
        log.debug("INSTANCEMANAGER", "Emitting event to endpoint: " + endpoint);
        let client = this.instanceSocketList[endpoint];
        if (!client) {
            log.error("INSTANCEMANAGER", "Socket client not found for endpoint: " + endpoint);
            throw new Error("Socket client not found for endpoint: " + endpoint);
        }
        client?.emit("agent", endpoint, eventName, ...args);
    }

    emitToAllEndpoints(eventName: string, ...args : unknown[]) {
        log.debug("INSTANCEMANAGER", "Emitting event to all endpoints");
        for (let endpoint in this.instanceSocketList) {
            this.emitToEndpoint(endpoint, eventName, ...args);
        }
    }

}
