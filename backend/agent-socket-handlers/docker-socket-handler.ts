import { AgentSocketHandler } from "../agent-socket-handler";
import { DockgeServer } from "../dockge-server";
import { callbackError, callbackResult, checkLogin, DockgeSocket, ValidationError } from "../util-server";
import { Stack } from "../stack";
import { AgentSocket } from "../../common/agent-socket";
import childProcessAsync from "promisify-child-process";

export class DockerSocketHandler extends AgentSocketHandler {
    create(socket : DockgeSocket, server : DockgeServer, agentSocket : AgentSocket) {
        // Do not call super.create()

        agentSocket.on("deployStack", async (name : unknown, composeYAML : unknown, composeENV : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);
                const stack = await this.saveStack(server, name, composeYAML, composeENV, isAdd);
                await stack.deploy(socket);
                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Deployed",
                    msgi18n: true,
                }, callback);
                stack.joinCombinedTerminal(socket);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("saveStack", async (name : unknown, composeYAML : unknown, composeENV : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);
                await this.saveStack(server, name, composeYAML, composeENV, isAdd);
                callbackResult({
                    ok: true,
                    msg: "Saved",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("deleteStack", async (name : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(name) !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);

                try {
                    await stack.delete(socket);
                } catch (e) {
                    server.sendStackList();
                    throw e;
                }

                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Deleted",
                    msgi18n: true,
                }, callback);

            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("getStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);

                if (stack.isManagedByDockge) {
                    stack.joinCombinedTerminal(socket);
                }

                callbackResult({
                    ok: true,
                    stack: await stack.toJSON(socket.endpoint),
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // requestStackList
        agentSocket.on("requestStackList", async (callback) => {
            try {
                checkLogin(socket);
                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Updated",
                    msgi18n: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // startStack
        agentSocket.on("startStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.start(socket);
                callbackResult({
                    ok: true,
                    msg: "Started",
                    msgi18n: true,
                }, callback);
                server.sendStackList();

                stack.joinCombinedTerminal(socket);

            } catch (e) {
                callbackError(e, callback);
            }
        });

        // stopStack
        agentSocket.on("stopStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.stop(socket);
                callbackResult({
                    ok: true,
                    msg: "Stopped",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // restartStack
        agentSocket.on("restartStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.restart(socket);
                callbackResult({
                    ok: true,
                    msg: "Restarted",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // updateStack
        agentSocket.on("updateStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.update(socket);
                callbackResult({
                    ok: true,
                    msg: "Updated",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // down stack
        agentSocket.on("downStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.down(socket);
                callbackResult({
                    ok: true,
                    msg: "Downed",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Services status
        agentSocket.on("serviceStatusList", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName, true);
                const serviceStatusList = Object.fromEntries(await stack.getServiceStatusList());
                callbackResult({
                    ok: true,
                    serviceStatusList,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // getExternalNetworkList
        agentSocket.on("getDockerNetworkList", async (callback) => {
            try {
                checkLogin(socket);
                const dockerNetworkList = await server.getDockerNetworkList();
                callbackResult({
                    ok: true,
                    dockerNetworkList,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // getDockerImageList
        agentSocket.on("getDockerImageList", async (callback) => {
            try {
                checkLogin(socket);
                const imageList = await this.getDockerImageList();
                callbackResult({
                    ok: true,
                    imageList,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // deleteDockerImage
        agentSocket.on("deleteDockerImage", async (imageId : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(imageId) !== "string") {
                    throw new ValidationError("Image ID must be a string");
                }
                await this.deleteDockerImage(imageId);
                callbackResult({
                    ok: true,
                    msg: "Image Deleted",
                    msgi18n: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // getDockerDiskUsage
        agentSocket.on("getDockerDiskUsage", async (callback) => {
            try {
                checkLogin(socket);
                const diskUsage = await this.getDockerDiskUsage();
                callbackResult({
                    ok: true,
                    diskUsage,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // pullDockerImage
        agentSocket.on("pullDockerImage", async (imageName : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(imageName) !== "string") {
                    throw new ValidationError("Image name must be a string");
                }
                await this.pullDockerImage(imageName);
                callbackResult({
                    ok: true,
                    msg: "Image Pulled",
                    msgi18n: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // buildDockerImage
        agentSocket.on("buildDockerImage", async (imageName : unknown, dockerfileContent : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(imageName) !== "string") {
                    throw new ValidationError("Image name must be a string");
                }
                if (typeof(dockerfileContent) !== "string") {
                    throw new ValidationError("Dockerfile content must be a string");
                }
                await this.buildDockerImage(imageName, dockerfileContent);
                callbackResult({
                    ok: true,
                    msg: "Image Built",
                    msgi18n: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // pruneDockerImages
        agentSocket.on("pruneDockerImages", async (callback) => {
            try {
                checkLogin(socket);
                const result = await this.pruneDockerImages();
                callbackResult({
                    ok: true,
                    msg: "Images Pruned",
                    msgi18n: true,
                    result,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }

    async saveStack(server : DockgeServer, name : unknown, composeYAML : unknown, composeENV : unknown, isAdd : unknown) : Promise<Stack> {
        // Check types
        if (typeof(name) !== "string") {
            throw new ValidationError("Name must be a string");
        }
        if (typeof(composeYAML) !== "string") {
            throw new ValidationError("Compose YAML must be a string");
        }
        if (typeof(composeENV) !== "string") {
            throw new ValidationError("Compose ENV must be a string");
        }
        if (typeof(isAdd) !== "boolean") {
            throw new ValidationError("isAdd must be a boolean");
        }

        const stack = new Stack(server, name, composeYAML, composeENV, false);
        await stack.save(isAdd);
        return stack;
    }

    /**
     * Get the list of Docker images
     * @returns List of Docker images with their details
     */
    async getDockerImageList() {
        const res = await childProcessAsync.spawn("docker", [ "images", "--format", "json" ], {
            encoding: "utf-8",
        });

        if (!res.stdout) {
            return [];
        }

        const output = res.stdout.toString().trim();
        if (!output) {
            return [];
        }

        const lines = output.split("\n");
        const imageList = lines.map((line : string) => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return null;
            }
        }).filter((img : unknown) => img !== null);

        return imageList;
    }

    /**
     * Delete a Docker image by ID or name
     * @param imageId - The image ID or name to delete
     * @throws Error with Docker error message if deletion fails
     */
    async deleteDockerImage(imageId : string) {
        try {
            await childProcessAsync.spawn("docker", [ "rmi", imageId ], {
                encoding: "utf-8",
            });
        } catch (error : any) {
            // Extract meaningful error message from Docker
            const stderr = error.stderr?.toString() || "";
            const stdout = error.stdout?.toString() || "";
            const errorMessage = stderr || stdout || error.message || "Failed to delete image";

            // Throw error with the actual Docker message
            throw new Error(errorMessage);
        }
    }

    /**
     * Get Docker disk usage information
     * @returns Docker disk usage statistics
     */
    async getDockerDiskUsage() {
        const res = await childProcessAsync.spawn("docker", [ "system", "df", "--format", "json" ], {
            encoding: "utf-8",
        });

        if (!res.stdout) {
            return {};
        }

        const output = res.stdout.toString().trim();
        if (!output) {
            return {};
        }

        return JSON.parse(output);
    }

    /**
     * Pull a Docker image from registry
     * @param imageName - The image name to pull (e.g., "nginx:latest")
     * @throws Error with Docker error message if pull fails
     */
    async pullDockerImage(imageName : string) {
        try {
            await childProcessAsync.spawn("docker", [ "pull", imageName ], {
                encoding: "utf-8",
            });
        } catch (error : any) {
            const stderr = error.stderr?.toString() || "";
            const stdout = error.stdout?.toString() || "";
            const errorMessage = stderr || stdout || error.message || "Failed to pull image";
            throw new Error(errorMessage);
        }
    }

    /**
     * Build a Docker image from Dockerfile content
     * @param imageName - The name/tag for the built image (e.g., "myapp:latest")
     * @param dockerfileContent - The content of the Dockerfile
     * @throws Error with Docker error message if build fails
     */
    async buildDockerImage(imageName : string, dockerfileContent : string) {
        const fs = await import("fs");
        const os = await import("os");
        const path = await import("path");

        // Create a temporary directory for the build context
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dockge-build-"));
        const dockerfilePath = path.join(tempDir, "Dockerfile");

        try {
            // Write Dockerfile content to temp directory
            fs.writeFileSync(dockerfilePath, dockerfileContent);

            // Build the image
            try {
                await childProcessAsync.spawn("docker", [ "build", "-t", imageName, tempDir ], {
                    encoding: "utf-8",
                });
            } catch (error : any) {
                const stderr = error.stderr?.toString() || "";
                const stdout = error.stdout?.toString() || "";
                const errorMessage = stderr || stdout || error.message || "Failed to build image";
                throw new Error(errorMessage);
            }
        } finally {
            // Clean up temp directory
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Prune unused Docker images
     * @returns Result of the prune operation
     */
    async pruneDockerImages() {
        const res = await childProcessAsync.spawn("docker", [ "image", "prune", "-a", "-f" ], {
            encoding: "utf-8",
        });

        return {
            stdout: res.stdout?.toString() || "",
            stderr: res.stderr?.toString() || "",
        };
    }

}


