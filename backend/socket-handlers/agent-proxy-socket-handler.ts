import { SocketHandler } from "../socket-handler.js";
import { DockgeServer } from "../dockge-server";
import { log } from "../log";
import { checkLogin, DockgeSocket } from "../util-server";
import { AgentSocket } from "../../common/agent-socket";

export class AgentProxySocketHandler extends SocketHandler {

    create2(socket : DockgeSocket, server : DockgeServer, agentSocket : AgentSocket) {
        // Agent - proxying requests if needed
        socket.on("agent", async (endpoint : unknown, eventName : unknown, ...args : unknown[]) => {
            try {
                checkLogin(socket);

                // Check Type
                if (typeof(endpoint) !== "string") {
                    throw new Error("Endpoint must be a string");
                }
                if (typeof(eventName) !== "string") {
                    throw new Error("Event name must be a string");
                }

                log.debug("agent", "Proxying request to " + endpoint + " for " + eventName);

                // Direct connection or matching endpoint
                if (!endpoint || endpoint === socket.endpoint) {
                    log.debug("agent", "Direct connection");
                    agentSocket.call(eventName, ...args);
                } else {
                    socket.instanceManager.emitToEndpoint(endpoint, eventName, ...args);
                }
            } catch (e) {
                if (e instanceof Error) {
                    log.warn("agent", e.message);
                }
            }
        });
    }

    create(socket : DockgeSocket, server : DockgeServer) {
        throw new Error("Method not implemented. Please use create2 instead.");
    }
}
