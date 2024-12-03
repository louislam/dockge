<template>
    <div class="shadow-box">
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div></div>
            <button v-if="mode !== 'interactive' && name !== 'console'" class="btn btn-sm btn-outline-secondary" @click="showWideTerminal = true">
                <font-awesome-icon icon="expand" class="me-1" />
                {{ $t("Expand") }}
            </button>
        </div>
        <div v-pre ref="terminal" class="main-terminal"></div>
    </div>

    <!-- Wide Terminal Modal -->
    <div v-if="showWideTerminal" class="modal-overlay" @click.self="showWideTerminal = false">
        <div class="wide-terminal-modal">
            <div class="modal-header d-flex justify-content-between align-items-center p-3">
                <h4 class="m-0">Terminal</h4>
                <button class="btn btn-sm btn-outline-secondary" @click="showWideTerminal = false">
                    <font-awesome-icon icon="times" />
                </button>
            </div>
            <div class="modal-body p-3">
                <div v-pre ref="wideTerminal" class="wide-terminal"></div>
            </div>
        </div>
    </div>
</template>

<script>
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { TERMINAL_COLS, TERMINAL_ROWS } from "../../../common/util-common";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

export default {
    /**
     * @type {Terminal}
     */
    terminal: null,
    wideTerminal: null,
    socket: null,
    components: {
        FontAwesomeIcon,
    },
    props: {
        name: {
            type: String,
            require: true,
        },

        endpoint: {
            type: String,
            require: true,
        },

        // Require if mode is interactive
        stackName: {
            type: String,
        },

        // Require if mode is interactive
        serviceName: {
            type: String,
        },

        // Require if mode is interactive
        shell: {
            type: String,
            default: "bash",
        },

        rows: {
            type: Number,
            default: TERMINAL_ROWS,
        },

        cols: {
            type: Number,
            default: TERMINAL_COLS,
        },

        // Mode
        // displayOnly: Only display terminal output
        // mainTerminal: Allow input limited commands and output
        // interactive: Free input and output
        mode: {
            type: String,
            default: "displayOnly",
        }
    },
    emits: [ "has-data" ],
    data() {
        return {
            first: true,
            terminalInputBuffer: "",
            cursorPosition: 0,
            showWideTerminal: false,
        };
    },
    created() {

    },
    mounted() {
        let cursorBlink = true;

        if (this.mode === "displayOnly") {
            cursorBlink = false;
        }

        const terminalConfig = {
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            cursorBlink,
            cols: this.cols,
            rows: this.rows,
            theme: {
                background: "#000000",
                foreground: "#ffffff",
                cursor: "#ffffff",
            }
        };

        this.terminal = new Terminal(terminalConfig);

        if (this.mode === "mainTerminal") {
            this.mainTerminalConfig(this.terminal);
        } else if (this.mode === "interactive") {
            this.interactiveTerminalConfig(this.terminal);
        }

        // Bind to a div
        this.terminal.open(this.$refs.terminal);
        this.terminal.focus();

        // Create a new Terminal
        if (this.mode === "mainTerminal") {
            this.$root.emitAgent(this.endpoint, "mainTerminal", this.name, (res) => {
                if (!res.ok) {
                    this.$root.toastRes(res);
                }
            });
        } else if (this.mode === "interactive") {
            console.debug("Create Interactive terminal:", this.name);
            this.$root.emitAgent(this.endpoint, "interactiveTerminal", this.stackName, this.serviceName, this.shell, (res) => {
                if (!res.ok) {
                    this.$root.toastRes(res);
                }
            });
        }

        // Bind terminal to socket
        this.bind();

        // Notify parent component when data is received
        this.terminal.onData((data) => {
            console.debug("onData triggered");
            if (this.first) {
                this.$emit("has-data");
                this.first = false;
            }
        });

        // Fit the terminal width to the div container size after terminal is created.
        this.updateTerminalSize();

        // Watch for wide terminal modal
        this.$watch("showWideTerminal", (newVal) => {
            if (newVal) {
                // Initialize wide terminal when modal is opened
                this.$nextTick(() => {
                    // Always reinitialize the terminal since the DOM element is new
                    if (this.wideTerminal) {
                        this.$root.unbindTerminal(this.name, this.wideTerminal);
                        this.wideTerminal.dispose();
                    }

                    this.wideTerminal = new Terminal({
                        ...terminalConfig,
                        rows: Math.floor(window.innerHeight * 0.7 / 20), // Approximate rows based on window height
                        cols: Math.floor(window.innerWidth * 0.8 / 9), // Approximate cols based on window width
                    });
                    this.wideTerminal.open(this.$refs.wideTerminal);

                    // Copy the terminal buffer content
                    const buffer = this.terminal.buffer.active;
                    for (let i = 0; i < buffer.length; i++) {
                        const line = buffer.getLine(i);
                        if (line) {
                            this.wideTerminal.write(`${line.translateToString()}\r\n`);
                        }
                    }

                    // Configure the wide terminal
                    if (this.mode === "mainTerminal") {
                        this.mainTerminalConfig(this.wideTerminal);
                    } else if (this.mode === "interactive") {
                        this.interactiveTerminalConfig(this.wideTerminal);
                    }

                    // Bind both terminals to the same name to receive the same updates
                    this.$root.bindTerminal(this.endpoint, this.name, this.wideTerminal);

                    // Listen for data on the wide terminal
                    this.wideTerminal.onData((data) => {
                        if (this.mode === "mainTerminal" || this.mode === "interactive") {
                            this.$root.emitAgent(this.endpoint, "terminalInput", this.name, data);
                        }
                    });
                });
            } else {
                // Cleanup terminal when modal is closed
                if (this.wideTerminal) {
                    this.$root.unbindTerminal(this.name, this.wideTerminal);
                    this.wideTerminal.dispose();
                    this.wideTerminal = null;
                }
            }
        });
    },

    unmounted() {
        window.removeEventListener("resize", this.onResizeEvent); // Remove the resize event listener from the window object.
        this.$root.unbindTerminal(this.name, this.terminal);
        this.terminal.dispose();
        // if (this.socket) {
        //     this.socket.close();
        // }
    },

    methods: {
        bind(endpoint, name) {
            // Workaround: normally this.name should be set, but it is not sometimes, so we use the parameter, but eventually this.name and name must be the same name
            if (name) {
                this.$root.unbindTerminal(name);
                this.$root.bindTerminal(endpoint, name, this.terminal);
                console.debug(`Terminal bound via parameter: ${name}`);
            } else if (this.name) {
                this.$root.unbindTerminal(this.name);
                this.$root.bindTerminal(this.endpoint, this.name, this.terminal);
                console.debug(`Terminal bound: ${this.name}`);
            } else {
                console.debug("Terminal name not set");
            }
        },

        removeInput() {
            const backspaceCount = this.terminalInputBuffer.length;
            const backspaces = "\b \b".repeat(backspaceCount);
            this.cursorPosition = 0;
            this.terminal.write(backspaces);
            this.terminalInputBuffer = "";
        },

        mainTerminalConfig(terminal = this.terminal) {
            terminal.onKey(e => {
                const code = e.key.charCodeAt(0);
                console.debug(`Encode: ${JSON.stringify(e.key)}`);

                if (e.key === "\r") {
                    // Return if no input
                    if (this.terminalInputBuffer.length === 0) {
                        return;
                    }

                    const buffer = this.terminalInputBuffer;

                    // Remove the input from the terminal
                    this.removeInput();

                    this.$root.emitAgent(this.endpoint, "terminalInput", this.name, buffer + e.key, (err) => {
                        this.$root.toastError(err.msg);
                    });

                } else if (code === 127) { // Backspace
                    if (this.cursorPosition > 0) {
                        this.terminal.write("\b \b");
                        this.cursorPosition--;
                        this.terminalInputBuffer = this.terminalInputBuffer.slice(0, -1);
                    }
                } else if (e.key === "\u001B\u005B\u0041" || e.key === "\u001B\u005B\u0042") {      // UP OR DOWN
                    // Do nothing

                } else if (e.key === "\u001B\u005B\u0043") {      // RIGHT
                    // TODO
                } else if (e.key === "\u001B\u005B\u0044") {      // LEFT
                    // TODO
                } else if (e.key === "\u0003") {      // Ctrl + C
                    console.debug("Ctrl + C");
                    this.$root.emitAgent(this.endpoint, "terminalInput", this.name, e.key);
                    this.removeInput();
                } else {
                    this.cursorPosition++;
                    this.terminalInputBuffer += e.key;
                    console.log(this.terminalInputBuffer);
                    this.terminal.write(e.key);
                }
            });
        },

        interactiveTerminalConfig(terminal = this.terminal) {
            terminal.onKey(e => {
                this.$root.emitAgent(this.endpoint, "terminalInput", this.name, e.key, (res) => {
                    if (!res.ok) {
                        this.$root.toastRes(res);
                    }
                });
            });
        },

        /**
         * Update the terminal size to fit the container size.
         *
         * If the terminalFitAddOn is not created, creates it, loads it and then fits the terminal to the appropriate size.
         * It then addes an event listener to the window object to listen for resize events and calls the fit method of the terminalFitAddOn.
         */
        updateTerminalSize() {
            if (!Object.hasOwn(this, "terminalFitAddOn")) {
                this.terminalFitAddOn = new FitAddon();
                this.terminal.loadAddon(this.terminalFitAddOn);
                window.addEventListener("resize", this.onResizeEvent);
            }
            this.terminalFitAddOn.fit();
        },
        /**
         * Handles the resize event of the terminal component.
         */
        onResizeEvent() {
            this.terminalFitAddOn.fit();
            const rows = this.terminal.rows;
            const cols = this.terminal.cols;
            this.$root.emitAgent(this.endpoint, "terminalResize", this.name, rows, cols);
        }
    }
};
</script>

<style scoped lang="scss">
.main-terminal {
    height: 100%;
    overflow-x: scroll;
}

.wide-terminal {
    height: 100%;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.wide-terminal-modal {
    background: #000000;
    border-radius: 8px;
    width: 90%;
    height: 90%;
    display: flex;
    flex-direction: column;
}

.modal-header {
    background: #000000;
    color: var(--bs-light);
    border-bottom: 1px solid #3f4148;
    border-radius: 8px 8px 0 0;
}

.modal-body {
    flex: 1;
    overflow: hidden;
    background-color: #000000;
}
</style>

<style lang="scss">
.terminal {
    background-color: black !important;
    height: 100%;
}
</style>
