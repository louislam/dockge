import { SocketHandler } from "../socket-handler.js";
import { DockgeServer } from "../dockge-server";
import { callbackError, checkLogin, DockgeSocket, ValidationError } from "../util-server";
import { log } from "../log";
import yaml from "yaml";
import path from "path";
import fs from "fs";
import {
    allowedCommandList,
    allowedRawKeys,
    getComposeTerminalName,
    isDev,
    PROGRESS_TERMINAL_ROWS
} from "../util-common";
import { Terminal } from "../terminal";
import { Stack } from "../stack";

export class DockerSocketHandler extends SocketHandler {
    create(socket : DockgeSocket, server : DockgeServer) {

        socket.on("deployStack", async (name : unknown, composeYAML : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);
                const stack = this.saveStack(socket, server, name, composeYAML, isAdd);
                await stack.deploy(socket);
                callback({
                    ok: true,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("saveStack", async (name : unknown, composeYAML : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);
                this.saveStack(socket, server, name, composeYAML, isAdd);
                callback({
                    ok: true,
                    "msg": "Saved"
                });
                server.sendStackList(socket);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("getStack", (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = Stack.getStack(server, stackName);
                callback({
                    ok: true,
                    stack: stack.toJSON(),
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }

    saveStack(socket : DockgeSocket, server : DockgeServer, name : unknown, composeYAML : unknown, isAdd : unknown) : Stack {
        // Check types
        if (typeof(name) !== "string") {
            throw new ValidationError("Name must be a string");
        }
        if (typeof(composeYAML) !== "string") {
            throw new ValidationError("Compose YAML must be a string");
        }
        if (typeof(isAdd) !== "boolean") {
            throw new ValidationError("isAdd must be a boolean");
        }

        const stack = new Stack(server, name, composeYAML);
        stack.save(isAdd);
        return stack;
    }
}

