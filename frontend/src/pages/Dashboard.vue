<template>
    <div class="container-fluid py-4 px-4">
        <div class="row">
            <!-- Mobile-only StackList and Compose Button -->
            <div v-if="$route.name === 'DashboardHome'" class="col-12 mb-4 d-md-none">
                <div class="mb-3">
                    <router-link to="/compose" class="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2">
                        <font-awesome-icon icon="plus" />
                        <span>{{ $t("compose") }}</span>
                    </router-link>
                </div>
                <StackList :scrollbar="true" />
            </div>

            <!-- Main view container (Full width on desktop) -->
            <div ref="container" class="col-12 mb-3">
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
    mounted() {
        this.height = this.$refs.container.offsetHeight;
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;

    @media (max-width: 767.98px) {
        padding-left: 8px !important;
        padding-right: 8px !important;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
    }
}
</style>
