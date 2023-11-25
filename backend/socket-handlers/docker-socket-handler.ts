import { SocketHandler } from "../socket-handler.js";
import { DockgeServer } from "../dockge-server";
import { callbackError, checkLogin, DockgeSocket, ValidationError } from "../util-server";
import { Stack } from "../stack";

// @ts-ignore
import composerize from "composerize";

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

                if (stack.isManagedByDockge) {
                    stack.joinCombinedTerminal(socket);
                }

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

        // down stack
        socket.on("downStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = Stack.getStack(server, stackName);
                await stack.down(socket);
                callback({
                    ok: true,
                    msg: "Downed"
                });
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Services status
        socket.on("serviceStatusList", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = Stack.getStack(server, stackName, true);
                const serviceStatusList = Object.fromEntries(await stack.getServiceStatusList());
                callback({
                    ok: true,
                    serviceStatusList,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // getExternalNetworkList
        socket.on("getDockerNetworkList", async (callback) => {
            try {
                checkLogin(socket);
                const dockerNetworkList = server.getDockerNetworkList();
                callback({
                    ok: true,
                    dockerNetworkList,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // composerize
        socket.on("composerize", async (dockerRunCommand : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(dockerRunCommand) !== "string") {
                    throw new ValidationError("dockerRunCommand must be a string");
                }

                const composeTemplate = composerize(dockerRunCommand);
                callback({
                    ok: true,
                    composeTemplate,
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

