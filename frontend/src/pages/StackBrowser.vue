<template>
    <transition name="slide-fade" appear>
        <div class="stack-browser">
            <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
                <h1 class="mb-0">{{ $t("stacks") }}</h1>
                <router-link to="/compose" class="btn btn-primary"><font-awesome-icon icon="plus" /> {{ $t("compose") }}</router-link>
            </div>
            <StackList />
        </div>
    </transition>
</template>

<script>
import StackList from "../components/StackList.vue";

export default {
    components: { StackList },
};
</script>

<style scoped lang="scss">
.stack-browser :deep(.shadow-box) {
    position: static;
    height: auto;
    min-height: calc(100dvh - 190px);
}
</style>
