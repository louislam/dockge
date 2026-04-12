import { DockgeServer } from "../dockge-server";
import { callbackError, callbackResult, checkLogin, DockgeSocket, ValidationError } from "../util-server";
import { log } from "../log";
import { InteractiveTerminal, MainTerminal, Terminal } from "../terminal";
import { Stack } from "../stack";
import { AgentSocketHandler } from "../agent-socket-handler";
import { AgentSocket } from "../../common/agent-socket";

export class TerminalSocketHandler extends AgentSocketHandler {
    create(socket : DockgeSocket, server : DockgeServer, agentSocket : AgentSocket) {

        agentSocket.on("terminalInput", async (terminalName : unknown, cmd : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(terminalName) !== "string") {
                    throw new Error("Terminal name must be a string.");
                }

                if (typeof(cmd) !== "string") {
                    throw new Error("Command must be a string.");
                }

                let terminal = Terminal.getTerminal(terminalName);
                if (terminal instanceof InteractiveTerminal) {
                    //log.debug("terminalInput", "Terminal found, writing to terminal.");
                    terminal.write(cmd);
                } else {
                    throw new Error("Terminal not found or it is not a Interactive Terminal.");
                }
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Main Terminal
        agentSocket.on("mainTerminal", async (terminalName : unknown, callback) => {
            try {
                checkLogin(socket);

                // Throw an error if console is not enabled
                if (!server.config.enableConsole) {
                    throw new ValidationError("Console is not enabled.");
                }

                // TODO: Reset the name here, force one main terminal for now
                terminalName = "console";

                if (typeof(terminalName) !== "string") {
                    throw new ValidationError("Terminal name must be a string.");
                }

                log.debug("mainTerminal", "Terminal name: " + terminalName);

                let terminal = Terminal.getTerminal(terminalName);

                if (!terminal) {
                    terminal = new MainTerminal(server, terminalName);
                    terminal.rows = 50;
                    log.debug("mainTerminal", "Terminal created");
                }

                terminal.join(socket);
                terminal.start();

                callbackResult({
                    ok: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Check if MainTerminal is enabled
        agentSocket.on("checkMainTerminal", async (callback) => {
            try {
                checkLogin(socket);
                callbackResult({
                    ok: server.config.enableConsole,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Interactive Terminal for containers
        agentSocket.on("interactiveTerminal", async (stackName : unknown, serviceName : unknown, shell : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string.");
                }

                if (typeof(serviceName) !== "string") {
                    throw new ValidationError("Service name must be a string.");
                }

                if (typeof(shell) !== "string") {
                    throw new ValidationError("Shell must be a string.");
                }

                log.debug("interactiveTerminal", "Stack name: " + stackName);
                log.debug("interactiveTerminal", "Service name: " + serviceName);

                // Get stack
                const stack = await Stack.getStack(server, stackName);
                stack.joinContainerTerminal(socket, serviceName, shell);

                callbackResult({
                    ok: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Join Output Terminal
        agentSocket.on("terminalJoin", async (terminalName : unknown, callback) => {
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

        // Leave Combined Terminal
        agentSocket.on("leaveCombinedTerminal", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                log.debug("leaveCombinedTerminal", "Stack name: " + stackName);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string.");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.leaveCombinedTerminal(socket);

                callbackResult({
                    ok: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Resize Terminal
        agentSocket.on("terminalResize", async (terminalName: unknown, rows: unknown, cols: unknown) => {
            log.info("terminalResize", `Terminal: ${terminalName}`);
            try {
                checkLogin(socket);
                if (typeof terminalName !== "string") {
                    throw new Error("Terminal name must be a string.");
                }

                if (typeof rows !== "number") {
                    throw new Error("Command must be a number.");
                }
                if (typeof cols !== "number") {
                    throw new Error("Command must be a number.");
                }

                let terminal = Terminal.getTerminal(terminalName);

                // log.info("terminal", terminal);
                if (terminal instanceof Terminal) {
                    //log.debug("terminalInput", "Terminal found, writing to terminal.");
                    terminal.rows = rows;
                    terminal.cols = cols;
                } else {
                    throw new Error(`${terminalName} Terminal not found.`);
                }
            } catch (e) {
                log.debug("terminalResize",
                        // Added to prevent the lint error when adding the type
                        // and ts type checker saying type is unknown.
                        // @ts-ignore
                        `Error on ${terminalName}: ${e.message}`
                );
            }
        });
    }
}
