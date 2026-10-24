<template>
    <div class="my-4">
        <p>{{ $t("User accounts help") }}</p>

        <form class="shadow-box big-padding mb-4" @submit.prevent="createUser">
            <h5 class="mb-3">{{ $t("Create user") }}</h5>
            <div class="row g-3">
                <div class="col-md-4">
                    <label class="form-label">{{ $t("Username") }}</label>
                    <input v-model="newUser.username" class="form-control" autocomplete="off" required>
                </div>
                <div class="col-md-4">
                    <label class="form-label">{{ $t("Password") }}</label>
                    <input v-model="newUser.password" class="form-control" type="password" autocomplete="new-password" required>
                </div>
                <div class="col-md-4">
                    <label class="form-label">{{ $t("Role") }}</label>
                    <select v-model="newUser.role" class="form-select" @change="clearAdminQuota(newUser)">
                        <option value="user">{{ $t("User") }}</option>
                        <option value="admin">{{ $t("Administrator") }}</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="form-label">{{ $t("CPU quota (cores)") }}</label>
                    <input v-model.number="newUser.cpuLimit" class="form-control" type="number" min="0" max="1024" step="0.1" :disabled="newUser.role === 'admin'">
                </div>
                <div class="col-md-4">
                    <label class="form-label">{{ $t("Memory quota (MiB)") }}</label>
                    <input v-model.number="newUser.memoryLimit" class="form-control" type="number" min="0" max="1048576" step="1" :disabled="newUser.role === 'admin'">
                </div>
                <div class="col-12">
                    <button class="btn btn-primary" type="submit" :disabled="processing">
                        {{ $t("Create user") }}
                    </button>
                </div>
            </div>
        </form>

        <div v-if="users.length" class="account-list">
            <section v-for="user in users" :key="user.id" class="account-card shadow-box">
                <div class="account-card-header">
                    <div>
                        <h5 class="mb-1">{{ user.username }}</h5>
                        <span v-if="user.username === currentUsername" class="current-user-badge">{{ $t("Current User") }}</span>
                    </div>
                    <label class="active-control">
                        <input v-model="user.active" class="form-check-input" type="checkbox" :aria-label="$t('Active')">
                        <span>{{ $t("Active") }}</span>
                    </label>
                </div>

                <div class="row g-3">
                    <div class="col-sm-6 col-xl-4">
                        <label class="form-label">{{ $t("Role") }}</label>
                        <select v-model="user.role" class="form-select" @change="clearAdminQuota(user)">
                            <option value="user">{{ $t("User") }}</option>
                            <option value="admin">{{ $t("Administrator") }}</option>
                        </select>
                    </div>
                    <div class="col-sm-6 col-xl-4">
                        <label class="form-label">{{ $t("CPU quota (cores)") }}</label>
                        <input v-model.number="user.cpuLimit" class="form-control" type="number" min="0" max="1024" step="0.1" :disabled="user.role === 'admin'">
                    </div>
                    <div class="col-sm-6 col-xl-4">
                        <label class="form-label">{{ $t("Memory quota (MiB)") }}</label>
                        <input v-model.number="user.memoryLimit" class="form-control" type="number" min="0" max="1048576" step="1" :disabled="user.role === 'admin'">
                    </div>
                    <div v-if="user.username !== currentUsername" class="col-sm-6 col-xl-8">
                        <label class="form-label">{{ $t("Reset password (optional)") }}</label>
                        <input v-model="user.password" class="form-control" type="password" autocomplete="new-password" :aria-label="$t('Reset password (optional)')">
                    </div>
                    <div class="col-12 account-actions">
                        <button class="btn btn-primary" :disabled="processing" @click="updateUser(user)">
                            {{ $t("Save changes") }}
                        </button>
                        <button class="btn btn-danger" :disabled="processing || user.username === currentUsername" @click="deleteUser(user)">
                            {{ $t("Delete user") }}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            processing: false,
            users: [],
            newUser: {
                username: "",
                password: "",
                role: "user",
                cpuLimit: 0,
                memoryLimit: 0,
            },
        };
    },

    computed: {
        currentUsername() {
            return this.$root.username;
        },
    },

    mounted() {
        this.loadUsers();
    },

    methods: {
        clearAdminQuota(user) {
            if (user.role === "admin") {
                user.cpuLimit = 0;
                user.memoryLimit = 0;
            }
        },

        loadUsers() {
            this.$root.getSocket().emit("listUsers", (res) => {
                if (!res.ok) {
                    this.$root.toastRes(res);
                    return;
                }
                this.users = res.users.map((user) => ({
                    id: Number(user.id),
                    username: user.username,
                    active: Boolean(user.active),
                    role: user.role,
                    cpuLimit: Number(user.cpu_limit),
                    memoryLimit: Math.floor(Number(user.memory_limit) / (1024 ** 2)),
                    password: "",
                }));
            });
        },

        createUser() {
            this.processing = true;
            this.$root.getSocket().emit("createUser", this.newUser, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.newUser = {
                        username: "",
                        password: "",
                        role: "user",
                        cpuLimit: 0,
                        memoryLimit: 0,
                    };
                    this.loadUsers();
                }
            });
        },

        updateUser(user) {
            this.processing = true;
            this.$root.getSocket().emit("updateUser", {
                id: user.id,
                active: user.active,
                role: user.role,
                cpuLimit: user.cpuLimit,
                memoryLimit: user.memoryLimit,
                password: user.password,
            }, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    user.password = "";
                    this.loadUsers();
                }
            });
        },

        deleteUser(user) {
            if (!window.confirm(`${this.$t("Delete user")} ${user.username}?`)) {
                return;
            }
            this.processing = true;
            this.$root.getSocket().emit("deleteUser", user.id, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadUsers();
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../styles/vars.scss";

.account-list {
    display: grid;
    gap: 1rem;
}

.account-card {
    padding: 1.25rem;
}

.account-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid $dark-border-color;
}

.current-user-badge {
    color: $dark-font-color3;
    font-size: 0.85rem;
}

.active-control {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
}

.account-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 0.5rem;
}
</style>
