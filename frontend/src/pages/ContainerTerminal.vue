<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">Bash</h1>
            <p>
                Stack: {{ stackName }}<br />
                Container: {{ serviceName }}
            </p>

            <Terminal class="terminal" :rows="20" mode="interactive" :name="terminalName" :stack-name="stackName" :service-name="serviceName"></Terminal>
        </div>
    </transition>
</template>

<script>
import { getContainerExecTerminalName } from "../../../backend/util-common";

export default {
    components: {
    },
    data() {
        return {

        };
    },
    computed: {
        stackName() {
            return this.$route.params.stackName;
        },
        serviceName() {
            return this.$route.params.serviceName;
        },
        terminalName() {
            return getContainerExecTerminalName(this.stackName, this.serviceName, 0);
        }
    },
    mounted() {

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
