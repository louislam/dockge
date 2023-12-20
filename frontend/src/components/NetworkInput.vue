<template>
    <div>
        <h5>{{ $t("Internal Networks") }}</h5>
        <ul class="list-group">
            <li v-for="(networkRow, index) in networkList" :key="index" class="list-group-item">
                <input v-model="networkRow.key" type="text" class="no-bg domain-input" placeholder="Network name..." />
                <font-awesome-icon icon="times" class="action remove ms-2 me-3 text-danger" @click="remove(index)" />
            </li>
        </ul>

        <button class="btn btn-normal btn-sm mt-3 me-2" @click="addField">{{ $t("addInternalNetwork") }}</button>

        <h5 class="mt-3">{{ $t("External Networks") }}</h5>

        <div v-if="externalNetworkList.length === 0">
            {{ $t("No External Networks") }}
        </div>

        <div v-for="(networkName, index) in externalNetworkList" :key="networkName" class="form-check form-switch my-3">
            <input :id=" 'external-network' + index" v-model="selectedExternalList[networkName]" class="form-check-input" type="checkbox">

            <label class="form-check-label" :for=" 'external-network' +index">
                {{ networkName }}
            </label>

            <span v-if="false" class="text-danger ms-2 delete">Delete</span>
        </div>

        <div v-if="false" class="input-group mb-3">
            <input
                placeholder="New external network name..."
                class="form-control"
                @keyup.enter="createExternelNetwork"
            />
            <button class="btn btn-normal btn-sm  me-2" type="button">
                {{ $t("createExternalNetwork") }}
            </button>
        </div>

        <div v-if="false">
            <button class="btn btn-primary btn-sm mt-3 me-2" @click="applyToYAML">{{ $t("applyToYAML") }}</button>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            networkList: [],
            externalList: {},
            selectedExternalList: {},
            externalNetworkList: [],
        };
    },
    computed: {
        jsonConfig() {
            return this.$parent.$parent.jsonConfig;
        },

        stack() {
            return this.$parent.$parent.stack;
        },

        editorFocus() {
            return this.$parent.$parent.editorFocus;
        },

        endpoint() {
            return this.$parent.$parent.endpoint;
        },
    },
    watch: {
        "jsonConfig.networks": {
            handler() {
                if (this.editorFocus) {
                    console.debug("jsonConfig.networks changed");
                    this.loadNetworkList();
                }
            },
            deep: true,
        },

        "selectedExternalList": {
            handler() {
                for (const networkName in this.selectedExternalList) {
                    const enable = this.selectedExternalList[networkName];

                    if (enable) {
                        if (!this.externalList[networkName]) {
                            this.externalList[networkName] = {};
                        }
                        this.externalList[networkName].external = true;
                    } else {
                        delete this.externalList[networkName];
                    }
                }
                this.applyToYAML();
            },
            deep: true,
        },

        "networkList": {
            handler() {
                this.applyToYAML();
            },
            deep: true,
        }

    },
    mounted() {
        this.loadNetworkList();
        this.loadExternalNetworkList();
    },
    methods: {
        loadNetworkList() {
            this.networkList = [];
            this.externalList = {};

            for (const key in this.jsonConfig.networks) {
                let obj = {
                    key: key,
                    value: this.jsonConfig.networks[key],
                };

                if (obj.value && obj.value.external) {
                    this.externalList[key] = Object.assign({}, obj.value);
                } else {
                    this.networkList.push(obj);
                }
            }

            // Restore selectedExternalList
            this.selectedExternalList = {};
            for (const networkName in this.externalList) {
                this.selectedExternalList[networkName] = true;
            }
        },

        loadExternalNetworkList() {
            this.$root.emitAgent(this.endpoint, "getDockerNetworkList", (res) => {
                if (res.ok) {
                    this.externalNetworkList = res.dockerNetworkList.filter((n) => {
                        // Filter out this stack networks
                        if (n.startsWith(this.stack.name + "_")) {
                            return false;
                        }
                        // They should be not supported.
                        // https://docs.docker.com/compose/compose-file/06-networks/#host-or-none
                        if (n === "none" || n === "host" || n === "bridge") {
                            return false;
                        }
                        return true;
                    });
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        addField() {
            this.networkList.push({
                key: "",
                value: {},
            });
        },

        remove(index) {
            this.networkList.splice(index, 1);
            this.applyToYAML();
        },

        applyToYAML() {
            if (this.editorFocus) {
                return;
            }

            this.jsonConfig.networks = {};

            // Internal networks
            for (const networkRow of this.networkList) {
                this.jsonConfig.networks[networkRow.key] = networkRow.value;
            }

            // External networks
            for (const networkName in this.externalList) {
                this.jsonConfig.networks[networkName] = this.externalList[networkName];
            }

            console.debug("applyToYAML", this.jsonConfig.networks);
        }

    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.list-group {
    background-color: $dark-bg2;

    li {
        display: flex;
        align-items: center;
        padding: 10px 0 10px 10px;

        .domain-input {
            flex-grow: 1;
            background-color: $dark-bg2;
            border: none;
            color: $dark-font-color;
            outline: none;

            &::placeholder {
                color: #1d2634;
            }
        }
    }
}

.delete {
    text-decoration: underline;
    font-size: 13px;
    cursor: pointer;
}
</style>
