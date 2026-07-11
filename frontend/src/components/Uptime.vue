<template>
    <span v-if="fixedWidth" class="status-dot" :class="'bg-' + color" :title="statusName"></span>
    <span v-else :class="className">{{ statusName }}</span>
</template>

<script>
import { statusColor, statusNameShort } from "../../../common/util-common";

export default {
    props: {
        stack: {
            type: Object,
            default: null,
        },
        fixedWidth: {
            type: Boolean,
            default: false,
        },
        pill: {
            type: Boolean,
            default: false,
        },
    },

    computed: {
        uptime() {
            return this.$t("notAvailableShort");
        },

        color() {
            return statusColor(this.stack?.status);
        },

        statusName() {
            return this.$t(statusNameShort(this.stack?.status));
        },

        className() {
            let className = `badge rounded-pill bg-${this.color}`;

            if (this.fixedWidth) {
                className += " fixed-width";
            }
            return className;
        },
    },
};
</script>

<style scoped>
.badge {
    min-width: 62px;
}

.fixed-width {
    width: 62px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.status-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
}
</style>
