<template>
    <div>
        <form class="my-4" @submit.prevent="saveScheduler">
            <div class="mb-3">
                <div class="form-check form-switch">
                    <input id="schedulerEnabled" v-model="scheduler.enabled" class="form-check-input" type="checkbox">
                    <label class="form-check-label" for="schedulerEnabled">
                        {{ $t("Enable auto-update scheduler") }}
                    </label>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label" for="schedulerCron">{{ $t("Cron Expression") }}</label>
                <input
                    id="schedulerCron"
                    v-model="scheduler.cronExpression"
                    class="form-control font-monospace"
                    type="text"
                    :disabled="!scheduler.enabled"
                />
            </div>

            <div v-if="scheduler.nextAutoUpdate" class="form-text mb-3">
                {{ $t("Next Auto Update") }}: {{ new Date(scheduler.nextAutoUpdate).toLocaleString() }}
            </div>

            <div class="d-flex gap-2">
                <button class="btn btn-primary" type="submit">{{ $t("Save") }}</button>
                <button class="btn btn-outline-primary" type="button" @click="triggerAutoUpdates">
                    {{ $t("Run Now") }}
                </button>
            </div>
        </form>
    </div>
</template>

<script>
export default {
    data() {
        return {
            scheduler: {
                enabled: false,
                cronExpression: "0 3 * * *",
                nextAutoUpdate: null,
            },
        };
    },

    mounted() {
        this.loadScheduler();
    },

    methods: {
        loadScheduler() {
            this.$root.getSocket().emit("getSchedulerSettings", (res) => {
                if (res.ok) {
                    this.scheduler = res.data;
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        saveScheduler() {
            this.$root.getSocket().emit("setSchedulerSettings", this.scheduler, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadScheduler();
                }
            });
        },

        triggerAutoUpdates() {
            this.$root.getSocket().emit("triggerAutoUpdates", (res) => {
                this.$root.toastRes(res);
                this.loadScheduler();
            });
        },
    },
};
</script>
