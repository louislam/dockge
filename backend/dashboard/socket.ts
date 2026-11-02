import { SocketHandler } from "../socket-handler";
import { DockgeServer } from "../dockge-server";
import { callbackError, callbackResult, checkLogin, DockgeSocket } from "../util-server";
import { DashboardConfigStore } from "./config";

export class DashboardSocketHandler extends SocketHandler {
    private store?: DashboardConfigStore;
    create(socket: DockgeSocket, server: DockgeServer) {
        const store = this.store ||= new DashboardConfigStore(server.config.dataDir);
        socket.on("dashboard:get", async (callback) => {
            try {
                checkLogin(socket);
                callbackResult({ ok: true,
                    ...await store.load() }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });
        socket.on("dashboard:saveConfig", async (config: unknown, callback) => {
            try {
                checkLogin(socket);
                await store.save(config);
                callbackResult({ ok: true }, callback);
                server.io.emit("dashboard:changed");
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }
}
