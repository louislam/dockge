<template>
    <span :class="className">{{ statusName }}</span>
</template>

<script>
import { statusColor, statusNameShort } from "../../../backend/util-common";

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
    },

    computed: {
        uptime() {
            return "0.00%";
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
}
</style>
