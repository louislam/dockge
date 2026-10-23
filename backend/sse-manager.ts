import { Response } from "express";
import { log } from "./log";

export class SseManager {
    private clients = new Set<Response>();
    private heartbeat?: NodeJS.Timeout;

    addClient(response: Response): void {
        this.clients.add(response);
        response.write(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);

        response.on("close", () => {
            this.clients.delete(response);
            if (this.clients.size === 0 && this.heartbeat) {
                clearInterval(this.heartbeat);
                this.heartbeat = undefined;
            }
        });

        if (!this.heartbeat) {
            this.heartbeat = setInterval(() => {
                this.broadcast("heartbeat", { timestamp: new Date().toISOString() });
            }, 30000);
        }
    }

    broadcast(event: string, data: object): void {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const client of this.clients) {
            try {
                client.write(message);
            } catch (e) {
                log.debug("sse", `Failed to write SSE event: ${e}`);
                this.clients.delete(client);
            }
        }
    }

    close(): void {
        if (this.heartbeat) {
            clearInterval(this.heartbeat);
        }
        for (const client of this.clients) {
            client.end();
        }
        this.clients.clear();
    }
}
