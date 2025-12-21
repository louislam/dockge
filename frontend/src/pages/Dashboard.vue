<template>
    <div class="container-fluid">
        <div class="row">
            <div v-if="!$root.isMobile" class="col-12 col-md-4 col-xl-3">
                <div class="button-group mb-3">
                    <router-link to="/compose" class="btn btn-primary"><font-awesome-icon icon="plus" /> {{ $t("compose") }}</router-link>
                    <button class="btn btn-normal" @click="openCloneModal"><font-awesome-icon icon="clone" /> {{ $t("cloneRepository") }}</button>
                </div>
                <StackList :scrollbar="true" />
            </div>

            <div ref="container" class="col-12 col-md-8 col-xl-9 mb-3">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" :calculatedHeight="height" />
            </div>
        </div>

        <CloneRepositoryModal ref="cloneModal" />
    </div>
</template>

<script>

import StackList from "../components/StackList.vue";
import CloneRepositoryModal from "../components/CloneRepositoryModal.vue";

export default {
    components: {
        StackList,
        CloneRepositoryModal,
    },
    data() {
        return {
            height: 0
        };
    },
    mounted() {
        this.height = this.$refs.container.offsetHeight;
    },
    methods: {
        openCloneModal() {
            this.$refs.cloneModal.open();
        },
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 98%;
}

.button-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.button-group .btn {
    width: 100%;
}
</style>
