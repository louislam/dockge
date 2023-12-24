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
        socket.on("removeAgent", async (data : unknown, callback : unknown) => {
            try {
                log.debug("manage-agent-socket-handler", "removeAgent");
                checkLogin(socket);
                await socket.instanceManager.remove(data.endpoint);
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }
}
