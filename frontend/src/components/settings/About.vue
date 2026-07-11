<template>
    <div class="d-flex justify-content-center align-items-center">
        <div class="logo d-flex flex-column justify-content-center align-items-center">
            <object class="my-4" width="200" height="200" data="/icon.svg" />
            <div class="fs-4 fw-bold mb-3">Bockge</div>
            <div class="mb-2">
                <a href="https://github.com/dsbok/dockge" target="_blank" rel="noopener" class="text-decoration-none text-primary">GitHub Repository</a>
            </div>
            <div class="text-secondary mt-1">Author: <a href="https://github.com/dsbok" target="_blank" rel="noopener" class="text-decoration-none text-primary">Danii Saahir</a></div>
        </div>
    </div>
</template>

<script>
export default {
    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },
    }
};
</script>

<style lang="scss" scoped>
.logo {
    margin: 4em 1em;
}
</style>
