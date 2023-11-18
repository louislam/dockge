<template>
    <div>
        <form class="my-4" autocomplete="off" @submit.prevent="saveGeneral">
            <!-- Client side Timezone -->
            <div v-if="false" class="mb-4">
                <label for="timezone" class="form-label">
                    {{ $t("Display Timezone") }}
                </label>
                <select id="timezone" v-model="$root.userTimezone" class="form-select">
                    <option value="auto">
                        {{ $t("Auto") }}: {{ guessTimezone }}
                    </option>
                    <option
                        v-for="(timezone, index) in timezoneList"
                        :key="index"
                        :value="timezone.value"
                    >
                        {{ timezone.name }}
                    </option>
                </select>
            </div>

            <!-- Server Timezone -->
            <div v-if="false" class="mb-4">
                <label for="timezone" class="form-label">
                    {{ $t("Server Timezone") }}
                </label>
                <select id="timezone" v-model="settings.serverTimezone" class="form-select">
                    <option value="UTC">UTC</option>
                    <option
                        v-for="(timezone, index) in timezoneList"
                        :key="index"
                        :value="timezone.value"
                    >
                        {{ timezone.name }}
                    </option>
                </select>
            </div>

            <!-- Primary Hostname -->
            <div class="mb-4">
                <label class="form-label" for="primaryBaseURL">
                    {{ $t("primaryHostname") }}
                </label>

                <div class="input-group mb-3">
                    <input
                        v-model="settings.primaryHostname"
                        class="form-control"
                        placeholder="localhost"
                    />
                    <button class="btn btn-outline-primary" type="button" @click="autoGetPrimaryHostname">
                        {{ $t("Auto Get") }}
                    </button>
                </div>

                <div class="form-text"></div>
            </div>

            <!-- Docker Endpoint -->
            <div class="mb-4">
                <label class="form-label" for="dockerEndpointList">
                    {{ $t("dockerEndpointList") }}
                </label>

                <Multiselect
                    id="dockerEndpointList"
                    v-model="settings.dockerEndpointList"
                    mode="tags"
                    :options="['/var/run/docker.sock']"
                    :value="['/var/run/docker.sock']"
                    :placeholder="$t('Enter The list of docker endpoints')"
                    :searchable="true"
                    :create-option="true"
                ></Multiselect>
            </div>

            <!-- Save Button -->
            <div>
                <button class="btn btn-primary" type="submit">
                    {{ $t("Save") }}
                </button>
            </div>
        </form>
    </div>
</template>

<script>
import HiddenInput from "../../components/HiddenInput.vue";
import dayjs from "dayjs";
import { timezoneList } from "../../util-frontend";
import Multiselect from '@vueform/multiselect'

export default {
    components: {
        HiddenInput,
        Multiselect,
    },

    data() {
        return {
            timezoneList: timezoneList(),
        };
    },

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
        guessTimezone() {
            return dayjs.tz.guess();
        }
    },

    methods: {
        /** Save the settings */
        saveGeneral() {
            localStorage.timezone = this.$root.userTimezone;
            this.saveSettings();
        },
        /** Get the base URL of the application */
        autoGetPrimaryHostname() {
            this.settings.primaryHostname = location.hostname;
        },
    },
};
</script>

<style src="@vueform/multiselect/themes/default.css">
</style>
<style>
.multiselect {
    background: #070a10;
    border-color: #1d2634;
    border-radius: var(--bs-border-radius);
}
.multiselect-tags-search {
    background: none;
}
.multiselect-tag {
    border-radius: var(--bs-border-radius);
}
</style>
