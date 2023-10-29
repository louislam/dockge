<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 v-if="isAdd" class="mb-3">Compose</h1>
            <h1 v-else class="mb-3"><Uptime :stack="globalStack" :pill="true" /> {{ stack.name }}</h1>

            <div v-if="stack.isManagedByDockge" class="mb-3">
                <div class="btn-group" role="group">
                    <button v-if="isEditMode" class="btn btn-primary" :disabled="processing" @click="deployStack">
                        <font-awesome-icon icon="rocket" class="me-1" />
                        {{ $t("deployStack") }}
                    </button>

                    <button v-if="isEditMode" class="btn btn-normal" :disabled="processing" @click="saveStack">
                        <font-awesome-icon icon="save" class="me-1" />
                        {{ $t("saveStackDraft") }}
                    </button>

                    <button v-if="!isEditMode" class="btn btn-normal" :disabled="processing" @click="isEditMode = true">{{ $t("editStack") }}</button>
                    <button v-if="isEditMode && !isAdd" class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button>
                    <button v-if="!isEditMode" class="btn btn-primary" :disabled="processing">{{ $t("updateStack") }}</button>
                    <button v-if="!isEditMode" class="btn btn-primary" :disabled="processing">{{ $t("startStack") }}</button>
                    <button v-if="!isEditMode" class="btn btn-primary " :disabled="processing">{{ $t("restartStack") }}</button>
                    <button v-if="!isEditMode" class="btn btn-danger" :disabled="processing">{{ $t("stopStack") }}</button>
                    <button v-if="!isEditMode" class="btn btn-danger" :disabled="processing" @click="showDeleteDialog = !showDeleteDialog">{{ $t("deleteStack") }}</button>
                </div>
            </div>

            <!-- Progress Terminal -->
            <transition name="slide-fade" appear>
                <Terminal
                    v-show="showProgressTerminal"
                    ref="progressTerminal"
                    :allow-input="false"
                    class="mb-3 terminal"
                    :rows="progressTerminalRows"
                    @has-data="showProgressTerminal = true; submitted = true;"
                ></Terminal>
            </transition>

            <div v-if="stack.isManagedByDockge" class="row">
                <div class="col">
                    <div v-if="isAdd">
                        <h4 class="mb-3">General</h4>
                        <div class="shadow-box big-padding mb-3">
                            <!-- Stack Name -->
                            <div class="mb-3">
                                <label for="name" class="form-label">{{ $t("stackName") }}</label>
                                <input id="name" v-model="stack.name" type="text" class="form-control" required>
                            </div>
                        </div>
                    </div>

                    <h4 class="mb-3">Containers</h4>
                    <div class="shadow-box big-padding mb-3">
                        <div v-for="(service, name) in jsonConfig.services" :key="name">
                            {{ name }} {{ service }}
                        </div>
                    </div>
                </div>
                <div class="col">
                    <h4 class="mb-3">compose.yaml</h4>

                    <!-- YAML editor -->
                    <div class="shadow-box mb-3 editor-box" :class="{'edit-mode' : isEditMode}">
                        <prism-editor ref="editor" v-model="stack.composeYAML" class="yaml-editor" :highlight="highlighter" line-numbers :readonly="!isEditMode" @input="yamlCodeChange"></prism-editor>
                    </div>
                    <div class="mb-3">
                        {{ yamlError }}
                    </div>

                    <!-- <div class="shadow-box big-padding mb-3">
                        <div class="mb-3">
                            <label for="name" class="form-label"> Search Templates</label>
                            <input id="name" v-model="name" type="text" class="form-control" placeholder="Search..." required>
                        </div>

                        <prism-editor v-if="false" v-model="yamlConfig" class="yaml-editor" :highlight="highlighter" line-numbers @input="yamlCodeChange"></prism-editor>
                    </div>-->
                </div>
            </div>

            <div v-if="!stack.isManagedByDockge">
                {{ $t("stackNotManagedByDockgeMsg") }}
            </div>

            <!-- Delete Dialog -->
            <BModal v-model="showDeleteDialog" :okTitle="$t('deleteStack')" okVariant="danger" @ok="deleteDialog">
                {{ $t("deleteStackMsg") }}
            </BModal>
        </div>
    </transition>
</template>

<script>
import { highlight, languages } from "prismjs/components/prism-core";
import { PrismEditor } from "vue-prism-editor";
import "prismjs/components/prism-yaml";
import * as yaml from "yaml";

import "prismjs/themes/prism-tomorrow.css";
import "vue-prism-editor/dist/prismeditor.min.css";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { getComposeTerminalName, PROGRESS_TERMINAL_ROWS } from "../../../backend/util-common";
import { BModal } from "bootstrap-vue-next";

const template = `version: "3.8"
services:
  nginx:
    image: nginx:latest
    ports:
      - "8080:8080"
`;

let yamlErrorTimeout = null;

export default {
    components: {
        FontAwesomeIcon,
        PrismEditor,
        BModal,
    },
    data() {
        return {
            jsonConfig: {},
            yamlError: "",
            processing: true,
            showProgressTerminal: false,
            progressTerminalRows: PROGRESS_TERMINAL_ROWS,
            stack: {

            },
            isEditMode: false,
            submitted: false,
            showDeleteDialog: false,
        };
    },
    computed: {
        isAdd() {
            return this.$route.path === "/compose" && !this.submitted;
        },

        /**
         * Get the stack from the global stack list, because it may contain more real-time data like status
         * @return {*}
         */
        globalStack() {
            return this.$root.stackList[this.stack.name];
        },
    },
    watch: {
        "stack.composeYAML": {
            handler() {
                this.yamlCodeChange();
            },
            deep: true,
        },
    },
    mounted() {
        if (this.isAdd) {
            this.processing = false;
            this.isEditMode = true;

            // Default Values
            this.stack = {
                name: "",
                composeYAML: template,
                isManagedByDockge: true,
            };

        } else {
            this.stack.name = this.$route.params.stackName;
            this.loadStack();
        }
    },
    methods: {
        bindTerminal() {
            // Bind Terminal output
            const terminalName = getComposeTerminalName(this.stack.name);
            this.$refs.progressTerminal.bind(terminalName);
        },
        loadStack() {
            this.$root.getSocket().emit("getStack", this.stack.name, (res) => {
                if (res.ok) {
                    this.stack = res.stack;
                    this.processing = false;
                    this.bindTerminal();
                } else {
                    this.$root.toastRes(res);
                }
            });
        },
        deployStack() {
            this.processing = true;

            this.bindTerminal();

            this.$root.getSocket().emit("deployStack", this.stack.name, this.stack.composeYAML, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.$router.push("/compose/" + this.stack.name);
                }
            });
        },
        saveStack() {
            this.processing = true;

            this.$root.getSocket().emit("saveStack", this.stack.name, this.stack.composeYAML, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.$router.push("/compose/" + this.stack.name);
                }
            });
        },
        deleteDialog() {
            this.$root.getSocket().emit("deleteStack", this.stack.name, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.$router.push("/");
                }
            });
        },

        discardStack() {
            this.loadStack();
            this.isEditMode = false;
        },

        highlighter(code) {
            return highlight(code, languages.yaml);
        },
        yamlCodeChange() {
            try {
                this.jsonConfig = yaml.parse(this.stack.composeYAML) ?? {};
                this.yamlError = "";
            } catch (e) {
                clearTimeout(yamlErrorTimeout);

                if (this.yamlError) {
                    this.yamlError = e.message;

                } else {
                    yamlErrorTimeout = setTimeout(() => {
                        this.yamlError = e.message;
                    }, 3000);
                }
            }
        },
    }
};
</script>

<style scoped lang="scss">
.terminal {
    height: 200px;
}

.editor-box.edit-mode {
    background-color: #2c2f38 !important;
}
</style>
