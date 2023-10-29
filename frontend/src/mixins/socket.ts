import { io } from "socket.io-client";
import { Socket } from "socket.io-client";
import { defineComponent } from "vue";
import jwtDecode from "jwt-decode";
import { Terminal } from "xterm";

let terminalInputBuffer = "";
let cursorPosition = 0;
let socket : Socket;

let terminalMap : Map<string, Terminal> = new Map();

function removeInput() {
    const backspaceCount = terminalInputBuffer.length;
    const backspaces = "\b \b".repeat(backspaceCount);
    cursorPosition = 0;
    terminal.write(backspaces);
    terminalInputBuffer = "";
}

export default defineComponent({
    data() {
        return {
            socketIO: {
                token: null,
                firstConnect: true,
                connected: false,
                connectCount: 0,
                initedSocketIO: false,
                connectionErrorMsg: `${this.$t("Cannot connect to the socket server.")} ${this.$t("Reconnecting...")}`,
                showReverseProxyGuide: true,
            },
            info: {

            },
            remember: (localStorage.remember !== "0"),
            loggedIn: false,
            allowLoginDialog: false,
            username: null,
            stackList: {},
        };
    },
    computed: {
        usernameFirstChar() {
            if (typeof this.username == "string" && this.username.length >= 1) {
                return this.username.charAt(0).toUpperCase();
            } else {
                return "🐻";
            }
        },
    },
    watch: {
        remember() {
            localStorage.remember = (this.remember) ? "1" : "0";
        },
    },
    created() {
        this.initSocketIO();
    },
    mounted() {
        return;
        terminal.onKey(e => {
            const code = e.key.charCodeAt(0);
            console.debug("Encode: " + JSON.stringify(e.key));

            if (e.key === "\r") {
                // Return if no input
                if (terminalInputBuffer.length === 0) {
                    return;
                }

                const buffer = terminalInputBuffer;

                // Remove the input from the terminal
                removeInput();

                socket.emit("terminalInput", buffer + e.key, (err) => {
                    this.toastError(err.msg);
                });

            } else if (code === 127) { // Backspace
                if (cursorPosition > 0) {
                    terminal.write("\b \b");
                    cursorPosition--;
                    terminalInputBuffer = terminalInputBuffer.slice(0, -1);
                }
            } else if (e.key === "\u001B\u005B\u0041" || e.key === "\u001B\u005B\u0042") {      // UP OR DOWN
                // Do nothing

            } else if (e.key === "\u001B\u005B\u0043") {      // RIGHT
                // TODO
            } else if (e.key === "\u001B\u005B\u0044") {      // LEFT
                // TODO
            } else if (e.key === "\u0003") {      // Ctrl + C
                console.debug("Ctrl + C");
                socket.emit("terminalInputRaw", e.key);
                removeInput();
            } else {
                cursorPosition++;
                terminalInputBuffer += e.key;
                console.log(terminalInputBuffer);
                terminal.write(e.key);
            }
        });
    },
    methods: {
        /**
         * Initialize connection to socket server
         * @param bypass Should the check for if we
         * are on a status page be bypassed?
         */
        initSocketIO(bypass = false) {
            // No need to re-init
            if (this.socketIO.initedSocketIO) {
                return;
            }

            this.socketIO.initedSocketIO = true;
            let url : string;
            const env = process.env.NODE_ENV || "production";
            if (env === "development" || localStorage.dev === "dev") {
                url = location.protocol + "//" + location.hostname + ":5001";
            } else {
                url = location.protocol + "//" + location.host;
            }

            socket = io(url, {
                transports: [ "websocket", "polling" ]
            });

            socket.on("connect", () => {
                console.log("Connected to the socket server");

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
                            if (! this.loggedIn) {
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
                this.socketIO.connectionErrorMsg = "Lost connection to the socket server. Reconnecting...";
                this.socketIO.connected = false;
            });

            socket.on("connect_error", (err) => {
                console.error(`Failed to connect to the backend. Socket.io connect_error: ${err.message}`);
                this.socketIO.connectionErrorMsg = `${this.$t("Cannot connect to the socket server.")} [${err}] ${this.$t("Reconnecting...")}`;
                this.socketIO.showReverseProxyGuide = true;
                this.socketIO.connected = false;
                this.socketIO.firstConnect = false;
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

            socket.on("terminalWrite", (terminalName, data) => {
                const terminal = terminalMap.get(terminalName);
                if (!terminal) {
                    console.error("Terminal not found: " + terminalName);
                    return;
                }
                terminal.write(data);
            });

            socket.on("stackList", (res) => {
                if (res.ok) {
                    this.stackList = res.stackList;
                }
            });

            socket.on("stackStatusList", (res) => {
                if (res.ok) {

                    console.log(res.stackStatusList);

                    for (let stackName in res.stackStatusList) {
                        const stackObj = this.stackList[stackName];
                        if (stackObj) {
                            stackObj.status = res.stackStatusList[stackName];
                        }
                    }
                }
            });
        },

        /**
         * The storage currently in use
         * @returns Current storage
         */
        storage() : Storage {
            return (this.remember) ? localStorage : sessionStorage;
        },

        getSocket() : Socket {
            return socket;
        },

        /**
         * Get payload of JWT cookie
         * @returns {(object | undefined)} JWT payload
         */
        getJWTPayload() {
            const jwtToken = this.storage().token;

            if (jwtToken && jwtToken !== "autoLogin") {
                return jwtDecode(jwtToken);
            }
            return undefined;
        },

        /**
         * Log in using a token
         * @param {string} token Token to log in with
         * @returns {void}
         */
        loginByToken(token : string) {
            socket.emit("loginByToken", token, (res) => {
                this.allowLoginDialog = true;

                if (! res.ok) {
                    this.logout();
                } else {
                    this.loggedIn = true;
                    this.username = this.getJWTPayload()?.username;
                    this.afterLogin();
                }
            });
        },

        /**
         * Log out of the web application
         * @returns {void}
         */
        logout() {
            socket.emit("logout", () => { });
            this.storage().removeItem("token");
            this.socketIO.token = null;
            this.loggedIn = false;
            this.username = null;
            this.clearData();
        },

        /**
         * @returns {void}
         */
        clearData() {

        },

        afterLogin() {

        },

        bindTerminal(terminalName : string, terminal : Terminal) {
            // Load terminal, get terminal screen
            socket.emit("terminalJoin", terminalName, (res) => {
                if (res.ok) {
                    terminal.write(res.buffer);
                    terminalMap.set(terminalName, terminal);
                } else {
                    this.toastRes(res);
                }
            });
        },

        unbindTerminal(terminalName : string) {
            terminalMap.delete(terminalName);
        }
    }
});
