<template>
    <div class="shadow-box">
        <div v-pre ref="terminal" class="main-terminal"></div>
    </div>
</template>

<script>
import { Terminal } from "xterm";
import { WebLinksAddon } from "xterm-addon-web-links";
import { TERMINAL_COLS, TERMINAL_ROWS } from "../../../backend/util-common";

export default {
    /**
     * @type {Terminal}
     */
    terminal: null,
    components: {

    },
    props: {
        allowInput: {
            type: Boolean,
            default: true,
        },
        rows: {
            type: Number,
            default: TERMINAL_ROWS,
        }
    },
    emits: [ "has-data" ],
    data() {
        return {
            name: null,
            first: true,
        };
    },
    created() {

    },
    mounted() {
        this.terminal = new Terminal({
            fontSize: 16,
            fontFamily: "monospace",
            cursorBlink: this.allowInput,
            cols: TERMINAL_COLS,
            rows: this.rows,
        });

        this.terminal.loadAddon(new WebLinksAddon());

        // Bind to a div
        this.terminal.open(this.$refs.terminal);
        this.terminal.focus();

        // Notify parent component when data is received
        this.terminal.onCursorMove(() => {
            console.debug("onData triggered");
            if (this.first) {
                this.$emit("has-data");
                this.first = false;
            }
        });
    },

    unmounted() {
        this.$root.unbindTerminal(this.name);
        this.terminal.dispose();
    },

    methods: {
        bind(name) {
            if (this.name) {
                this.$root.unbindTerminal(this.name);
            }
            this.name = name;
            this.$root.bindTerminal(this.name, this.terminal);
        },
    }
};
</script>

<style scoped lang="scss">
.main-terminal {
    height: 100%;
}
</style>

<style lang="scss">
.terminal {
    padding: 10px 15px;
    height: 100%;
}
</style>
