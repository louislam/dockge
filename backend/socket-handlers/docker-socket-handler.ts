import { SocketHandler } from "../socket-handler.js";
import { DockgeServer } from "../dockge-server";
import { callbackError, checkLogin, DockgeSocket, ValidationError } from "../util-server";
import { Stack } from "../stack";

export class DockerSocketHandler extends SocketHandler {
    create(socket : DockgeSocket, server : DockgeServer) {

        socket.on("deployStack", async (name : unknown, composeYAML : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);
                const stack = this.saveStack(socket, server, name, composeYAML, isAdd);
                await stack.deploy(socket);
                server.sendStackList();
                callback({
                    ok: true,
                    msg: "Deployed",
                });
                stack.joinCombinedTerminal(socket);
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
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("deleteStack", async (name : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(name) !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = Stack.getStack(server, name);

                try {
                    await stack.delete(socket);
                } catch (e) {
                    server.sendStackList();
                    throw e;
                }

                server.sendStackList();
                callback({
                    ok: true,
                    msg: "Deleted"
                });

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

                stack.joinCombinedTerminal(socket);

                callback({
                    ok: true,
                    stack: stack.toJSON(),
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // requestStackList
        socket.on("requestStackList", async (callback) => {
            try {
                checkLogin(socket);
                server.sendStackList();
                callback({
                    ok: true,
                    msg: "Updated"
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // startStack
        socket.on("startStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = Stack.getStack(server, stackName);
                await stack.start(socket);
                callback({
                    ok: true,
                    msg: "Started"
                });
                server.sendStackList();

                stack.joinCombinedTerminal(socket);

            } catch (e) {
                callbackError(e, callback);
            }
        });

        // stopStack
        socket.on("stopStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = Stack.getStack(server, stackName);
                await stack.stop(socket);
                callback({
                    ok: true,
                    msg: "Stopped"
                });
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // restartStack
        socket.on("restartStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = Stack.getStack(server, stackName);
                await stack.restart(socket);
                callback({
                    ok: true,
                    msg: "Restarted"
                });
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // updateStack
        socket.on("updateStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = Stack.getStack(server, stackName);
                await stack.update(socket);
                callback({
                    ok: true,
                    msg: "Updated"
                });
                server.sendStackList();
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

