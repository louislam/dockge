import { SocketHandler } from "../socket-handler.js";
import { DockgeServer } from "../dockge-server";
import { checkLogin, DockgeSocket } from "../util-server";
import { log } from "../log";

const allowedCommandList : string[] = [
    "docker",
];

export class DockerSocketHandler extends SocketHandler {
    create(socket : DockgeSocket, server : DockgeServer) {

        socket.on("composeUp", async (compose, callback) => {

        });

        socket.on("terminalInput", async (cmd : unknown, errorCallback) => {
            try {
                checkLogin(socket);

                if (typeof(cmd) !== "string") {
                    throw new Error("Command must be a string.");
                }

                // Check if the command is allowed
                const cmdParts = cmd.split(" ");
                const executable = cmdParts[0].trim();
                log.debug("console", "Executable: " + executable);
                log.debug("console", "Executable length: " + executable.length);

                if (!allowedCommandList.includes(executable)) {
                    throw new Error("Command not allowed.");
                }

                server.terminal.write(cmd);
            } catch (e) {
                errorCallback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Setup
        socket.on("getTerminalBuffer", async (callback) => {
            try {
                checkLogin(socket);
                callback({
                    ok: true,
                    buffer: server.terminal.getBuffer(),
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }

        });
    }
}
