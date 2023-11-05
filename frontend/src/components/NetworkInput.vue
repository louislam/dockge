<template>
    <div>
        <h5>Internal Networks</h5>

        <ul class="list-group">
            <li v-for="(networkRow, index) in networkList" :key="index" class="list-group-item">
                <input v-model="networkList[index].key" type="text" class="no-bg domain-input" placeholder="Network name..." />
                <font-awesome-icon icon="times" class="action remove ms-2 me-3 text-danger" @click="remove(index)" />
            </li>
        </ul>

        <button class="btn btn-normal btn-sm mt-3" @click="addField">{{ $t("addNetwork") }}</button>

        <h5 class="mt-3">External Networks</h5>
    </div>
</template>

<script>
export default {
    props: {

    },
    data() {
        return {
            networkList: [],
        };
    },
    computed: {

        isInited() {
            return this.networks !== undefined;
        },

        networks() {
            return this.$parent.$parent.networks;
        },

    },
    watch: {
        networks: {
            handler() {
                this.loadNetworkList();
            },
            deep: true,
        },
        networkList: {
            handler() {
            },
            deep: true,
        }
    },
    mounted() {
        this.loadNetworkList();
    },
    methods: {

        loadNetworkList() {
            console.debug("loadNetworkList", this.networks);

            this.networkList = [];
            for (const key in this.networks) {
                this.networkList.push({
                    key: key,
                    value: this.networks[key],
                });
            }
        },

        addField() {
            this.networkList.push({
                key: "",
                value: {},
            });
        },
        remove(index) {
            this.networkList.splice(index, 1);
        },
    }
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
</style>
