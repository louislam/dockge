<template>
    <div>
        <div v-if="settingsLoaded" class="my-4">
            <form class="my-4" autocomplete="off" @submit.prevent="saveGeneral">
                <div class="shadow-box mb-3 editor-box edit-mode">
                    <prism-editor
                        ref="editor"
                        v-model="settings.globalENV"
                        class="env-editor"
                        :highlight="highlighterENV"
                        line-numbers
                    ></prism-editor>
                </div>

                <div class="my-4">
                    <!-- Save Button -->
                    <div>
                        <button class="btn btn-primary" type="submit">
                            {{ $t("Save") }}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>
</template>

<script>
import { highlight, languages } from "prismjs/components/prism-core";
import { PrismEditor } from "vue-prism-editor";

let prismjsSymbolDefinition = {
    "symbol": {
        pattern: /(?<!\$)\$(\{[^{}]*\}|\w+)/,
    }
};

export default {
    components: {
        PrismEditor,
    },

    data() {
        return {
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
        }
    },

    methods: {
        /** Save the settings */
        saveGeneral() {
            this.saveSettings();
        },

        highlighterENV(code) {
            if (!languages.docker_env) {
                languages.docker_env = {
                    "comment": {
                        pattern: /(^#| #).*$/m,
                        greedy: true
                    },
                    "keyword": {
                        pattern: /^\w*(?=[:=])/m,
                        greedy: true
                    },
                    "value": {
                        pattern: /(?<=[:=]).*?((?= #)|$)/m,
                        greedy: true,
                        inside: {
                            "string": [
                                {
                                    pattern: /^ *'.*?(?<!\\)'/m,
                                },
                                {
                                    pattern: /^ *".*?(?<!\\)"|^.*$/m,
                                    inside: prismjsSymbolDefinition
                                },
                            ],
                        },
                    },
                };
            }
            return highlight(code, languages.docker_env);
        },
    },
};
</script>

<style scoped lang="scss">

.editor-box {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    &.edit-mode {
        background-color: #2c2f38 !important;
    }
}
</style>
