import { SocketHandler } from "../socket-handler.js";
import { DockgeServer } from "../dockge-server";
import { callbackError, checkLogin, DockgeSocket, ValidationError } from "../util-server";
import { log } from "../log";
import yaml from "yaml";
import path from "path";
import fs from "fs";
import { allowedCommandList, allowedRawKeys, isDev } from "../util-common";
import { Terminal } from "../terminal";

export class TerminalSocketHandler extends SocketHandler {
    create(socket : DockgeSocket, server : DockgeServer) {

        socket.on("terminalInputRaw", async (key : unknown) => {
            try {
                checkLogin(socket);

                if (typeof(key) !== "string") {
                    throw new Error("Key must be a string.");
                }

                if (allowedRawKeys.includes(key)) {
                    server.terminal.write(key);
                }
            } catch (e) {

            }
        });

        socket.on("terminalInput", async (terminalName : unknown, cmd : unknown, errorCallback : unknown) => {
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
                if (typeof(errorCallback) === "function") {
                    errorCallback({
                        ok: false,
                        msg: e.message,
                    });
                }
            }
        });

        // Create Terminal
        socket.on("terminalCreate", async (terminalName : unknown, callback : unknown) => {

        });

        // Join Terminal
        socket.on("terminalJoin", async (terminalName : unknown, callback : unknown) => {
            if (typeof(callback) !== "function") {
                log.debug("console", "Callback is not a function.");
                return;
            }

            try {
                checkLogin(socket);
                if (typeof(terminalName) !== "string") {
                    throw new ValidationError("Terminal name must be a string.");
                }

                let buffer : string = Terminal.getTerminal(terminalName)?.getBuffer() ?? "";

                if (!buffer) {
                    log.debug("console", "No buffer found.");
                }

                callback({
                    ok: true,
                    buffer,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Close Terminal
        socket.on("terminalClose", async (terminalName : unknown, callback : unknown) => {

        });

        // Resize Terminal
        socket.on("terminalResize", async (rows : unknown) => {
            try {
                checkLogin(socket);
                if (typeof(rows) !== "number") {
                    throw new Error("Rows must be a number.");
                }
                log.debug("console", "Resize terminal to " + rows + " rows.");
                server.terminal.resize(rows);
            } catch (e) {

            }
        });
    }
}
