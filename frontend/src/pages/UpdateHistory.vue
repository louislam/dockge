<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ $t("Update History") }}</h1>

            <div class="shadow-box big-padding">
                <div v-if="loading" class="text-center p-3">{{ $t("loading") }}</div>
                <div v-else class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>{{ $t("Datetime") }}</th>
                                <th>{{ $t("stackName") }}</th>
                                <th>{{ $t("Trigger") }}</th>
                                <th>{{ $t("Status") }}</th>
                                <th>{{ $t("Duration") }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="entry in entries" :key="entry.id">
                                <tr class="cursor-pointer" @click="expandedId = expandedId === entry.id ? null : entry.id">
                                    <td>{{ new Date(entry.startedAt).toLocaleString() }}</td>
                                    <td>{{ entry.stackName }}</td>
                                    <td>{{ entry.triggerType }}</td>
                                    <td>
                                        <span class="badge" :class="entry.success ? 'bg-success' : 'bg-danger'">
                                            {{ entry.success ? $t("success") : $t("failed") }}
                                        </span>
                                    </td>
                                    <td>{{ entry.durationMs ? `${(entry.durationMs / 1000).toFixed(1)}s` : "-" }}</td>
                                </tr>
                                <tr v-if="expandedId === entry.id">
                                    <td colspan="5">
                                        <pre v-if="entry.output" class="p-2">{{ entry.output }}</pre>
                                        <div v-if="entry.errorMessage" class="text-danger">{{ entry.errorMessage }}</div>
                                    </td>
                                </tr>
                            </template>
                            <tr v-if="entries.length === 0">
                                <td colspan="5" class="text-center text-muted">{{ $t("noData") }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
export default {
    data() {
        return {
            loading: true,
            entries: [],
            expandedId: null,
        };
    },

    mounted() {
        this.$root.getSocket().emit("getUpdateHistory", { limit: 100 }, (res) => {
            this.loading = false;
            if (res.ok) {
                this.entries = res.data.entries;
            } else {
                this.$root.toastRes(res);
            }
        });
    },
};
</script>

<style scoped>
.cursor-pointer {
    cursor: pointer;
}

pre {
    max-height: 300px;
    overflow: auto;
    white-space: pre-wrap;
}
</style>
