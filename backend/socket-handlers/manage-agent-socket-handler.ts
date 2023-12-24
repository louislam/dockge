import { SocketHandler } from "../socket-handler.js";
import { DockgeServer } from "../dockge-server";
import { log } from "../log";
import { callbackError, checkLogin, DockgeSocket } from "../util-server";

export class ManageAgentSocketHandler extends SocketHandler {

    create(socket : DockgeSocket, server : DockgeServer) {
        // addAgent
        socket.on("addAgent", async (data : unknown, callback : unknown) => {
            try {
                log.debug("manage-agent-socket-handler", "addAgent");
                checkLogin(socket);
                let manager = socket.instanceManager;
                await manager.test(data.url, data.username, data.password);
                await manager.add(data.url, data.username, data.password);

                // connect to the agent
                manager.connect(data.url, data.username, data.password);

                // Refresh another sockets
                // It is a bit difficult to control another browser sessions to connect/disconnect agents, so force them to refresh the page will be easier.
                server.disconnectAllSocketClients(undefined, socket.id);
                manager.sendAgentList();

                callback({
                    ok: true,
                    msg: "agentAddedSuccessfully",
                    msgi18n: true,
                });

            } catch (e) {
                callbackError(e, callback);
            }
        });

        // removeAgent
        socket.on("removeAgent", async (url : unknown, callback : unknown) => {
            try {
                log.debug("manage-agent-socket-handler", "removeAgent");
                checkLogin(socket);
                let manager = socket.instanceManager;
                await manager.remove(url);

                server.disconnectAllSocketClients(undefined, socket.id);
                manager.sendAgentList();

                callback({
                    ok: true,
                    msg: "agentRemovedSuccessfully",
                    msgi18n: true,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }
}
