<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">Console</h1>

            <div class="shadow-box">
                <div v-pre id="terminal"></div>
            </div>
        </div>
    </transition>
</template>

<script>

export default {
    components: {

    },
    mounted() {
        this.$root.getTerminal().open(document.querySelector("#terminal"));
    },
    methods: {

    }
};
</script>

<style scoped lang="scss">
.terminal {
    font-family: monospace;
    font-size: 18px;
    padding: 10px 15px;
    height: calc(100vh - 200px);
}
</style>
