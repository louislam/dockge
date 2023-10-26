<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">Console</h1>

            <div>
                <p>
                    Allowed commands: <code>docker</code>, <code>ls</code>, <code>cd</code>
                </p>
            </div>

            <Terminal :allow-input="true" class="terminal"></Terminal>
        </div>
    </transition>
</template>

<script>

export default {
    components: {
    },
    mounted() {
        this.$root.terminalFit(50);
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
