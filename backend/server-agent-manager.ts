import { io, Socket as SocketClient } from "socket.io-client";
import dayjs, { Dayjs } from "dayjs";
import { Agent } from "./models/agent";
import { log } from "./log";
import { LooseObject, sleep } from "../common/util-common";

export class ServerAgentManager {
    private agentSockets: Record<string, SocketClient> = {};
    private loggedIn: Record<string, boolean> = {};
    private versions: Record<string, string> = {};
    private firstConnectTime: Dayjs = dayjs();

    connect(url: string, username: string, password: string): void {
        const endpoint = new URL(url).host;
        if (!endpoint || this.agentSockets[endpoint]) {
            return;
        }

        const client = io(url, {
            extraHeaders: { endpoint },
        });

        client.on("connect", () => {
            client.emit("login", {
                username,
                password
            }, (res: LooseObject) => {
                this.loggedIn[endpoint] = !!res.ok;
                if (!res.ok) {
                    log.error("server-agent-manager", `Failed to log in to ${endpoint}`);
                }
            });
        });
        client.on("disconnect", () => {
            this.loggedIn[endpoint] = false;
        });
        client.on("connect_error", (error) => {
            log.error("server-agent-manager", `${endpoint}: ${error.message}`);
        });
        client.on("info", (data: LooseObject) => {
            if (typeof data.version === "string") {
                this.versions[endpoint] = data.version;
            }
        });

        this.agentSockets[endpoint] = client;
    }

    async connectAll(): Promise<void> {
        this.firstConnectTime = dayjs();
        const agents = await Agent.getAgentList();
        for (const url in agents) {
            const agent = agents[url];
            if (agent.url) {
                this.connect(agent.url, agent.username, agent.password);
            }
        }
    }

    disconnectAll(): void {
        for (const endpoint in this.agentSockets) {
            this.agentSockets[endpoint].disconnect();
        }
    }

    async emitToEndpoint(endpoint: string, eventName: string, ...args: unknown[]): Promise<void> {
        const client = this.agentSockets[endpoint];
        if (!client) {
            throw new Error(`Agent ${endpoint} is not configured`);
        }

        let elapsed = dayjs().diff(this.firstConnectTime, "second");
        while ((!client.connected || !this.loggedIn[endpoint]) && elapsed < 10) {
            await sleep(500);
            elapsed = dayjs().diff(this.firstConnectTime, "second");
        }
        if (!client.connected || !this.loggedIn[endpoint]) {
            throw new Error(`Agent ${endpoint} is not connected`);
        }

        client.emit("agent", endpoint, eventName, ...args);
    }

    isConnected(endpoint: string): boolean {
        return !!(this.agentSockets[endpoint]?.connected && this.loggedIn[endpoint]);
    }

    getVersion(endpoint: string): string | null {
        return this.versions[endpoint] ?? null;
    }
}
