<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">Console</h1>

            <div>
                <p>
                    Allowed commands: <code>docker</code>, <code>ls</code>, <code>cd</code>
                </p>
            </div>

            <Terminal ref="terminal" :allow-input="true" class="terminal" :rows="20"></Terminal>
        </div>
    </transition>
</template>

<script>

export default {
    components: {
    },
    mounted() {
        // Bind Terminal Component to Socket.io
        const terminalName = "console";
        this.$refs.terminal.bind(terminalName);

        // Create a new Terminal
        this.$root.getSocket().emit("mainTerminal", terminalName, (res) => {
            if (!res.ok) {
                this.$root.toastRes(res);
            }
        });
    },
    methods: {

    }
};
</script>

<style scoped lang="scss">
.terminal {
    height: calc(100vh - 200px);
}
</style>
