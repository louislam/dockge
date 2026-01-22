<template>
    <div class="wrapper">
        <div class="group-header">
            {{ agentName }}
        </div>

        <slot />
    </div>

    <hr>
</template>

<script setup lang="ts">
interface AgentStackListProps {
    agentName: string;
}

defineProps<AgentStackListProps>();
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.group-header {
    border-bottom: 1px solid #dee2e6;
    border-radius: 10px;
    margin-bottom: 10px;
    font-size: 1.25rem;
    font-weight: 500;
    padding: 10px;

    .dark & {
        background-color: darken($color: $dark-header-bg, $amount: 1.90);
        border-bottom: 0;
    }
}

@media (max-width: 770px) {
    .group-header {
        margin: -20px;
        margin-bottom: 10px;
        padding: 5px;
    }
}

</style>
