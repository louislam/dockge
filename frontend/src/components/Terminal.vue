<template>
    <div class="terminal-shell shadow-box">
        <div v-if="showToolbar" class="terminal-toolbar">
            <button class="btn btn-sm btn-normal" @click="focus"><font-awesome-icon icon="terminal" /> {{ $t("focusTerminal") }}</button>
            <button class="btn btn-sm btn-normal" :disabled="!hasSelection" @click="copySelection"><font-awesome-icon icon="copy" /> {{ $t("copySelection") }}</button>
            <button v-if="acceptsInput" class="btn btn-sm btn-normal" @click="handlePaste"><font-awesome-icon icon="paste" /> {{ $t("paste") }}</button>
            <button class="btn btn-sm btn-normal" @click="clear"><font-awesome-icon icon="trash" /> {{ $t("clearDisplay") }}</button>
        </div>
        <div v-pre ref="terminal" class="main-terminal"></div>
    </div>
</template>

<script>
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { TERMINAL_COLS, TERMINAL_ROWS } from "../../../common/util-common";

export default {
    /**
     * @type {Terminal}
     */
    terminal: null,
    components: {

    },
    props: {
        name: {
            type: String,
            required: true,
        },

        endpoint: {
            type: String,
            required: true,
        },

        // Require if mode is interactive
        stackName: {
            type: String,
            default: "",
        },

        // Require if mode is interactive
        serviceName: {
            type: String,
            default: "",
        },

        // Require if mode is interactive
        shell: {
            type: String,
            default: "bash",
        },

        containerName: {
            type: String,
            default: "",
        },

        autoFollow: {
            type: Boolean,
            default: false,
        },

        rows: {
            type: Number,
            default: TERMINAL_ROWS,
        },

        cols: {
            type: Number,
            default: TERMINAL_COLS,
        },

        showToolbar: {
            type: Boolean,
            default: true,
        },

        // Mode
        // displayOnly: Only display terminal output
        // mainTerminal: Free input and output for the Dockge console
        // interactive: Free input and output through Docker Compose
        // interactiveContainer: Free input and output for one container instance
        mode: {
            type: String,
            default: "displayOnly",
        }
    },
    emits: [ "has-data", "ready", "follow-change", "selection-change" ],
    data() {
        return {
            first: true,
            followOutput: this.autoFollow,
            hasSelection: false,
        };
    },
    computed: {
        acceptsInput() {
            return this.mode === "mainTerminal" || this.mode === "interactive" || this.mode === "interactiveContainer";
        },
    },
    created() {

    },
    mounted() {
        let cursorBlink = true;

        if (this.mode === "displayOnly") {
            cursorBlink = false;
        }

        this.terminal = new Terminal({
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            cursorBlink,
            cols: this.cols,
            rows: this.rows,
        });

        this.terminal.attachCustomKeyEventHandler(this.handleTerminalKeyEvent);

        if (this.acceptsInput) {
            this.interactiveTerminalConfig();
        }

        //this.terminal.loadAddon(new WebLinksAddon());

        // Bind to a div
        this.terminal.open(this.$refs.terminal);
        this.terminal.focus();

        // Add right-click context menu handler for paste
        this.$refs.terminal.addEventListener("contextmenu", this.handleContextMenu);

        // Add selection handler for copy to clipboard
        this.terminal.onSelectionChange(() => {
            this.handleSelection();
        });

        this.terminal.onScroll((position) => {
            if (this.followOutput && position < this.terminal.buffer.active.baseY) {
                this.setFollow(false);
            }
        });

        this.terminal.onWriteParsed(() => {
            if (this.followOutput) {
                this.terminal.scrollToBottom();
            }
        });

        // Notify parent component when data is received
        this.terminal.onCursorMove(() => {
            console.debug("onData triggered");
            if (this.first) {
                this.$emit("has-data");
                this.first = false;
            }
        });

        this.bind(undefined, undefined, () => {
            this.$emit("ready");

            // Create a new Terminal
            if (this.mode === "mainTerminal") {
                this.$root.emitAgent(this.endpoint, "mainTerminal", this.name, (res) => {
                    if (!res.ok) {
                        this.$root.toastRes(res);
                    } else {
                        this.onResizeEvent();
                    }
                });
            } else if (this.mode === "interactive") {
                console.debug("Create Interactive terminal:", this.name);
                this.$root.emitAgent(this.endpoint, "interactiveTerminal", this.stackName, this.serviceName, this.shell, (res) => {
                    if (!res.ok) {
                        this.$root.toastRes(res);
                    } else {
                        this.onResizeEvent();
                    }
                });
            } else if (this.mode === "interactiveContainer") {
                this.$root.emitAgent(this.endpoint, "interactiveContainerTerminal", this.stackName, this.containerName, this.shell, (res) => {
                    if (!res.ok) {
                        this.$root.toastRes(res);
                    } else {
                        this.onResizeEvent();
                    }
                });
            }
        });
        // Fit the terminal width to the div container size after terminal is created.
        this.updateTerminalSize();
    },

    unmounted() {
        window.removeEventListener("resize", this.onResizeEvent); // Remove the resize event listener from the window object.
        if (this.mode === "interactive") {
            this.$root.emitAgent(this.endpoint, "leaveInteractiveTerminal", this.stackName, this.serviceName, this.shell, () => {});
        } else if (this.mode === "interactiveContainer") {
            this.$root.emitAgent(this.endpoint, "leaveInteractiveContainerTerminal", this.stackName, this.containerName, this.shell, () => {});
        }
        this.$root.unbindTerminal(this.name);
        this.terminal.dispose();
        this.$refs.terminal?.removeEventListener("contextmenu", this.handleContextMenu);
    },

    methods: {
        bind(endpoint, name, callback) {
            // Workaround: normally this.name should be set, but it is not sometimes, so we use the parameter, but eventually this.name and name must be the same name
            if (name) {
                this.$root.unbindTerminal(name);
                this.$root.bindTerminal(endpoint, name, this.terminal, callback);
                console.debug("Terminal bound via parameter: " + name);
            } else if (this.name) {
                this.$root.unbindTerminal(this.name);
                this.$root.bindTerminal(this.endpoint, this.name, this.terminal, callback);
                console.debug("Terminal bound: " + this.name);
            } else {
                console.debug("Terminal name not set");
            }
        },

        interactiveTerminalConfig() {
            this.terminal.onData(data => {
                this.sendTerminalInput(data);
            });
        },

        handleTerminalKeyEvent(event) {
            if (event.type !== "keydown") {
                return true;
            }

            const key = event.key.toLowerCase();
            const shortcut = event.ctrlKey || event.metaKey;
            if (shortcut && key === "c" && this.terminal.hasSelection()) {
                this.copySelection();
                return false;
            }
            if (this.acceptsInput && shortcut && key === "v") {
                this.handlePaste();
                return false;
            }
            return true;
        },

        /**
         * Forward raw terminal input to the backing PTY.
         *
         * @param {string} input Raw data emitted by xterm
         */
        sendTerminalInput(input) {
            this.$root.emitAgent(this.endpoint, "terminalInput", this.name, input, (res) => {
                if (!res.ok) {
                    this.$root.toastRes(res);
                }
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
            let rows = this.terminal.rows;
            let cols = this.terminal.cols;
            this.$root.emitAgent(this.endpoint, "terminalResize", this.name, rows, cols);
        },

        fit() {
            this.updateTerminalSize();
        },

        clear() {
            this.terminal.clear();
        },

        focus() {
            this.terminal.focus();
        },

        setFollow(enabled) {
            this.followOutput = enabled;
            if (enabled) {
                this.terminal.scrollToBottom();
            }
            this.$emit("follow-change", enabled);
        },

        async copySelection() {
            const selectedText = this.terminal.getSelection();
            if (!selectedText) {
                return false;
            }
            await this.copyToClipboard(selectedText);
            return true;
        },

        /**
         * Handle clipboard paste operation
         */
        async handlePaste() {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    this.pasteText(text);
                }
            } catch (error) {
                console.error("Failed to read from clipboard:", error);
            }
        },

        /**
         * Paste text into the terminal based on current mode
         */
        pasteText(text) {
            if (this.acceptsInput) {
                // Let xterm encode bracketed paste mode before forwarding the raw data.
                this.terminal.paste(text);
            }
        },

        /**
         * Handle right-click context menu for paste operation
         */
        handleContextMenu(event) {
            if (this.terminal.hasSelection()) {
                event.preventDefault();
                this.copySelection();
            } else if (this.acceptsInput) {
                event.preventDefault();
                this.handlePaste();
            }
        },

        /**
         * Handle text selection in terminal - copy to clipboard
         */
        handleSelection() {
            const selectedText = this.terminal.getSelection();
            this.hasSelection = selectedText.length > 0;
            this.$emit("selection-change", this.hasSelection);
        },

        /**
         * Copy text to clipboard
         */
        async copyToClipboard(text) {
            try {
                if (!navigator.clipboard?.writeText) {
                    throw new Error("Clipboard API unavailable");
                }
                await navigator.clipboard.writeText(text);
            } catch (error) {
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                const copied = document.execCommand("copy");
                textarea.remove();
                if (!copied) {
                    console.error("Failed to copy to clipboard:", error);
                }
            }
        },
    }
};
</script>

<style scoped lang="scss">
.main-terminal {
    min-height: 0;
    height: 100%;
}

.terminal-shell {
    display: flex;
    overflow: hidden;
    flex-direction: column;
}

.terminal-toolbar {
    display: flex;
    flex: 0 0 auto;
    overflow-x: auto;
    gap: 0.4rem;
    padding: 0.5rem;
    background: #161b22;
}

.terminal-toolbar .btn {
    flex: 0 0 auto;
    padding-inline: 0.75rem;
}

@media (max-width: 991.98px) {
    .terminal-toolbar .btn {
        min-height: 44px;
    }
}
</style>

<style lang="scss">
.terminal {
    background-color: black !important;
    height: 100%;
}
</style>
