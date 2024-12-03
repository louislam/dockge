import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { defineComponent } from "vue";
import jwtDecode from "jwt-decode";
import type { Terminal } from "@xterm/xterm";
import { AgentSocket } from "../../../common/agent-socket";

let socket: Socket;

// Change from Map<string, Terminal> to Map<string, Terminal[]> to support multiple terminals
const terminalMap: Map<string, Terminal[]> = new Map();

/**
 * Socket mixin for handling WebSocket connections and terminal management
 * @mixin
 */
export default defineComponent({
    data() {
        return {
            /**
             * Socket.io connection state and configuration
             */
            socketIO: {
                /**
                 * Authentication token
                 */
                token: null,
                /**
                 * Flag for first connection attempt
                 */
                firstConnect: true,
                /**
                 * Flag for current connection state
                 */
                connected: false,
                /**
                 * Number of connection attempts
                 */
                connectCount: 0,
                /**
                 * Flag for initialization of socket.io
                 */
                initedSocketIO: false,
                /**
                 * Error message for connection issues
                 */
                connectionErrorMsg: `${this.$t("Cannot connect to the socket server.")} ${this.$t("Reconnecting...")}`,
                /**
                 * Flag for showing reverse proxy guide
                 */
                showReverseProxyGuide: true,
                /**
                 * Flag for current connection attempt
                 */
                connecting: false,
            },
            /**
             * Information about the current user and application
             */
            info: {},
            /**
             * Flag for remembering user login
             */
            remember: localStorage.remember !== "0",
            /**
             * Flag for user login state
             */
            loggedIn: false,
            /**
             * Flag for allowing login dialog
             */
            allowLoginDialog: false,
            /**
             * Current username
             */
            username: null,
            /**
             * Compose template
             */
            composeTemplate: "",

            /**
             * List of stacks
             */
            stackList: {},

            /**
             * All stack list from all agents
             */
            allAgentStackList: {} as Record<string, object>,

            /**
             * Agent status list (online/offline/connecting)
             */
            agentStatusList: {},

            /**
             * Agent list
             */
            agentList: {},
        };
    },
    /**
     * Computed properties for socket management and user interface
     */
    computed: {
        /**
         * Returns the total number of connected agents
         * @returns {number} Number of agents in the agentList
         */
        agentCount() {
            return Object.keys(this.agentList).length;
        },

        /**
         * Returns a combined list of stacks from all agents
         * @returns {Record<string, object>} Combined list of stacks with their configurations
         */
        completeStackList() {
            const list: Record<string, object> = {};

            for (const stackName in this.stackList) {
                list[`${stackName}_`] = this.stackList[stackName];
            }

            for (const endpoint in this.allAgentStackList) {
                const instance = this.allAgentStackList[endpoint];
                for (const stackName in instance.stackList) {
                    list[`${stackName}_${endpoint}`] = instance.stackList[stackName];
                }
            }
            return list;
        },

        /**
         * Gets the first character of the username in uppercase
         * @returns {string} First character of username or default emoji
         */
        usernameFirstChar() {
            if (typeof this.username === "string" && this.username.length >= 1) {
                return this.username.charAt(0).toUpperCase();
            }
            return "🐬";
        },

        /**
         *  Frontend Version
         *  It should be compiled to a static value while building the frontend.
         *  Please see ./frontend/vite.config.ts, it is defined via vite.js
         * @returns {string}
         */
        frontendVersion() {
            // eslint-disable-next-line no-undef
            return FRONTEND_VERSION;
        },

        /**
         * Checks if frontend and backend versions match
         * @returns {boolean} True if versions match or no backend version available
         */
        isFrontendBackendVersionMatched() {
            if (!this.info.version) {
                return true;
            }
            return this.info.version === this.frontendVersion;
        },
    },
    /**
     * Lifecycle hooks and watchers
     */
    watch: {
        "socketIO.connected"() {
            if (this.socketIO.connected) {
                this.agentStatusList[""] = "online";
            } else {
                this.agentStatusList[""] = "offline";
            }
        },

        remember() {
            localStorage.remember = this.remember ? "1" : "0";
        },

        // Reload the SPA if the server version is changed.
        "info.version"(to, from) {
            if (from && from !== to) {
                window.location.reload();
            }
        },
    },
    created() {
        this.initSocketIO();
    },
    mounted() {
        return;
    },
    /**
     * Socket and authentication methods
     */
    methods: {
        /**
         * Formats the endpoint display name
         * @param {string} endpoint - The endpoint to format
         * @returns {string} Formatted endpoint name or "currentEndpoint" for empty endpoint
         */
        endpointDisplayFunction(endpoint: string) {
            if (endpoint) {
                return endpoint;
            } else {
                return this.$t("currentEndpoint");
            }
        },

        /**
         * Initializes socket.io connection and sets up event handlers
         * @param {boolean} [bypass=false] - Whether to bypass status page check
         */
        initSocketIO(bypass = false) {
            // No need to re-init
            if (this.socketIO.initedSocketIO) {
                return;
            }

            this.socketIO.initedSocketIO = true;
            let url: string;
            const env = process.env.NODE_ENV || "production";
            if (env === "development" || localStorage.dev === "dev") {
                url = `${location.protocol}//${location.hostname}:5001`;
            } else {
                url = `${location.protocol}//${location.host}`;
            }

            const connectingMsgTimeout = setTimeout(() => {
                this.socketIO.connecting = true;
            }, 1500);

            socket = io(url);

            // Handling events from agents
            const agentSocket = new AgentSocket();
            socket.on("agent", (eventName: unknown, ...args: unknown[]) => {
                agentSocket.call(eventName, ...args);
            });

            socket.on("connect", () => {
                console.log("Connected to the socket server");

                clearTimeout(connectingMsgTimeout);
                this.socketIO.connecting = false;

                this.socketIO.connectCount++;
                this.socketIO.connected = true;
                this.socketIO.showReverseProxyGuide = false;
                const token = this.storage().token;

                if (token) {
                    if (token !== "autoLogin") {
                        console.log("Logging in by token");
                        this.loginByToken(token);
                    } else {
                        // Timeout if it is not actually auto login
                        setTimeout(() => {
                            if (!this.loggedIn) {
                                this.allowLoginDialog = true;
                                this.storage().removeItem("token");
                            }
                        }, 5000);
                    }
                } else {
                    this.allowLoginDialog = true;
                }

                this.socketIO.firstConnect = false;
            });

            socket.on("disconnect", () => {
                console.log("disconnect");
                this.socketIO.connectionErrorMsg = `${this.$t("Lost connection to the socket server. Reconnecting...")}`;
                this.socketIO.connected = false;
            });

            socket.on("connect_error", (err) => {
                console.error(
                    `Failed to connect to the backend. Socket.io connect_error: ${err.message}`,
                );
                this.socketIO.connectionErrorMsg = `${this.$t("Cannot connect to the socket server.")} [${err}] ${this.$t("reconnecting...")}`;
                this.socketIO.showReverseProxyGuide = true;
                this.socketIO.connected = false;
                this.socketIO.firstConnect = false;
                this.socketIO.connecting = false;
            });

            // Custom Events

            socket.on("info", (info) => {
                this.info = info;
            });

            socket.on("autoLogin", () => {
                this.loggedIn = true;
                this.storage().token = "autoLogin";
                this.socketIO.token = "autoLogin";
                this.allowLoginDialog = false;
                this.afterLogin();
            });

            socket.on("setup", () => {
                console.log("setup");
                this.$router.push("/setup");
            });

            agentSocket.on("terminalWrite", (terminalName, data) => {
                const terminals = terminalMap.get(terminalName);
                if (!terminals) {
                    //console.error("Terminal not found: " + terminalName);
                    return;
                }
                // Write to all terminals with this name
                for (const terminal of terminals) {
                    terminal.write(data);
                }
            });

            agentSocket.on("stackList", (res) => {
                if (res.ok) {
                    if (!res.endpoint) {
                        this.stackList = res.stackList;
                    } else {
                        if (!this.allAgentStackList[res.endpoint]) {
                            this.allAgentStackList[res.endpoint] = {
                                stackList: {},
                            };
                        }
                        this.allAgentStackList[res.endpoint].stackList = res.stackList;
                    }
                }
            });

            socket.on("stackStatusList", (res) => {
                if (res.ok) {
                    for (const stackName in res.stackStatusList) {
                        const stackObj = this.stackList[stackName];
                        if (stackObj) {
                            stackObj.status = res.stackStatusList[stackName];
                        }
                    }
                }
            });

            socket.on("agentStatus", (res) => {
                this.agentStatusList[res.endpoint] = res.status;

                if (res.msg) {
                    this.toastError(res.msg);
                }
            });

            socket.on("agentList", (res) => {
                console.log(res);
                if (res.ok) {
                    this.agentList = res.agentList;
                }
            });

            socket.on("refresh", () => {
                location.reload();
            });
        },

        /**
         * Gets the current storage instance
         * @returns {Storage} Current storage instance
         */
        storage(): Storage {
            return this.remember ? localStorage : sessionStorage;
        },

        /**
         * Gets the socket instance
         * @returns {Socket} Socket.io instance
         */
        getSocket(): Socket {
            return socket;
        },

        /**
         * Emits an event to a specific agent
         * @param {string} endpoint - Target agent endpoint
         * @param {string} eventName - Name of the event to emit
         * @param {...unknown[]} args - Arguments to pass with the event
         */
        emitAgent(endpoint: string, eventName: string, ...args: unknown[]) {
            this.getSocket().emit("agent", endpoint, eventName, ...args);
        },

        /**
         * Gets the JWT payload from the current token
         * @returns {object | undefined} Decoded JWT payload or undefined
         */
        getJWTPayload() {
            const jwtToken = this.storage().token;

            if (jwtToken && jwtToken !== "autoLogin") {
                return jwtDecode(jwtToken);
            }
            return undefined;
        },

        /**
         * Authenticates user with credentials or token
         * @param {string} username - Username for authentication
         * @param {string} password - Password for authentication
         * @param {string} token - Authentication token
         * @param {Function} callback - Callback function after authentication attempt
         */
        login(username: string, password: string, token: string, callback) {
            this.getSocket().emit(
                "login",
                {
                    username,
                    password,
                    token,
                },
                (res) => {
                    if (res.tokenRequired) {
                        callback(res);
                    }

                    if (res.ok) {
                        this.storage().token = res.token;
                        this.socketIO.token = res.token;
                        this.loggedIn = true;
                        this.username = this.getJWTPayload()?.username;

                        this.afterLogin();

                        // Trigger Chrome Save Password
                        history.pushState({}, "");
                    }

                    callback(res);
                },
            );
        },

        /**
         * Authenticates user using stored token
         * @param {string} token - Authentication token
         */
        loginByToken(token: string) {
            socket.emit("loginByToken", token, (res) => {
                this.allowLoginDialog = true;

                if (!res.ok) {
                    this.logout();
                } else {
                    this.loggedIn = true;
                    this.username = this.getJWTPayload()?.username;
                    this.afterLogin();
                }
            });
        },

        /**
         * Logs out the current user
         */
        logout() {
            socket.emit("logout", () => {});
            this.storage().removeItem("token");
            this.socketIO.token = null;
            this.loggedIn = false;
            this.username = null;
            this.clearData();
        },

        /**
         * Clears all user data from storage
         */
        clearData() {},

        /**
         * Handles post-login operations
         */
        afterLogin() {},

        /**
         * Binds a terminal to a specific endpoint
         * @param {string} endpoint - Target endpoint
         * @param {string} terminalName - Name of the terminal
         * @param {Terminal} terminal - Terminal instance to bind
         */
        bindTerminal(endpoint: string, terminalName: string, terminal: Terminal) {
            // Load terminal, get terminal screen
            this.emitAgent(endpoint, "terminalJoin", terminalName, (res) => {
                if (res.ok) {
                    terminal.write(res.buffer);
                    if (!terminalMap.has(terminalName)) {
                        terminalMap.set(terminalName, []);
                    }
                    terminalMap.get(terminalName).push(terminal);
                } else {
                    this.toastRes(res);
                }
            });
        },

        /**
         * Unbinds a terminal from socket events
         * @param {string} terminalName - Name of the terminal to unbind
         * @param {Terminal} terminal - Terminal instance to unbind
         */
        unbindTerminal(terminalName: string, terminal: Terminal) {
            const terminals = terminalMap.get(terminalName);
            if (terminals) {
                const index = terminals.indexOf(terminal);
                if (index > -1) {
                    terminals.splice(index, 1);
                }
                if (terminals.length === 0) {
                    terminalMap.delete(terminalName);
                }
            }
        },
    },
});
