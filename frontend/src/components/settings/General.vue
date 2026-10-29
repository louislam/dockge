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
                        :placeholder="$t(`CurrentHostname`)"
                    />
                    <button class="btn btn-outline-primary" type="button" @click="autoGetPrimaryHostname">
                        {{ $t("autoGet") }}
                    </button>
                </div>

                <div class="form-text"></div>
            </div>

            <!-- Default Compose Template -->
            <div class="mb-4">
                <label class="form-label" for="defaultTemplateURL">
                    {{ $t("defaultComposeTemplate") }}
                </label>

                <code-mirror
                    ref="editor"
                    v-model="settings.template"
                    :extensions="extensions"
                    minimal
                    wrap="true"
                    dark="true"
                    tab="true"
                />
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

import dayjs from "dayjs";
import { timezoneList } from "../../util-frontend";
import CodeMirror from "vue-codemirror6";
import { yaml } from "@codemirror/lang-yaml";
import { dracula as editorTheme } from "thememirror";
import { lineNumbers } from "@codemirror/view";
import { defaultComposeTemplate } from "../../../../common/util-common.ts";

export default {
    components: {
        CodeMirror
    },

    setup() {
        const extensions = [
            editorTheme,
            yaml(),
            lineNumbers(),
        ];
        return {
            extensions: extensions
        };
    },

    data() {
        return {
            timezoneList: timezoneList(),
        };
    },

    computed: {
        settings() {
            const settings = this.$parent.$parent.$parent.settings;
            if (!settings.template) {
                settings.template = defaultComposeTemplate;
            }
            return settings;
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

