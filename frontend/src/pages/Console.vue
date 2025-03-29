<template>
    <transition name="slide-fade" appear>
        <div v-if="!processing">
            <h1 class="mb-3">Console</h1>

            <Terminal v-if="enableConsole" class="terminal" :rows="20" mode="mainTerminal" name="console" :endpoint="endpoint"></Terminal>

            <div v-else class="alert alert-warning shadow-box" role="alert">
                <h4 class="alert-heading">Console is not enabled</h4>
                <p>
                    Console is a powerful tool that allows you to execute any commands such as <code>docker</code>, <code>rm</code> within the Dockge's container in this Web UI.
                </p>

                <p>
                    It might be dangerous since this Dockge container is connecting to the host's Docker daemon. Also Dockge could be possibly taken down by commands like <code>rm -rf</code>.
                </p>

                <p>
                    If you understand the risk, you can enable it by setting <code>DOCKGE_ENABLE_CONSOLE=true</code> in the environment variables.
                </p>
            </div>
        </div>
    </transition>
</template>

<script>
export default {
    components: {
    },
    data() {
        return {
            processing: true,
            enableConsole: false,
        };
    },
    computed: {
        endpoint() {
            return this.$route.params.endpoint || "";
        },
    },
    mounted() {
        this.$root.emitAgent(this.endpoint, "checkMainTerminal", (res) => {
            this.enableConsole = res.ok;
            this.processing = false;
        });
    },
    methods: {

    }
};
</script>

<style scoped lang="scss">
.terminal {
    height: 410px;
}
</style>
