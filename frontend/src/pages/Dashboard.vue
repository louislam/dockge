<template>
    <div class="container-fluid">
        <div class="row">
            <div v-if="!$root.isMobile && !isHomePage" class="col-12 col-md-4 col-xl-3">
                <div>
                    <router-link to="/compose" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("compose") }}</router-link>
                </div>
                <StackList :scrollbar="true" />
            </div>

            <div ref="container" class="col-12 mb-3" :class="contentColClass">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" :calculatedHeight="height" />
            </div>
        </div>
    </div>
</template>

<script>

import StackList from "../components/StackList.vue";

export default {
    components: {
        StackList,
    },
    data() {
        return {
            height: 0
        };
    },
    computed: {
        isHomePage() {
            return this.$route.name === "DashboardHome" || this.$route.path === "/";
        },
        contentColClass() {
            if (this.$root.isMobile || this.isHomePage) {
                return {};
            }
            return {
                "col-md-8": true,
                "col-xl-9": true,
            };
        },
    },
    mounted() {
        this.height = this.$refs.container.offsetHeight;
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 98%;
}
</style>
