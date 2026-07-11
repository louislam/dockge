<template>
    <div>
        <div v-if="settingsLoaded" class="my-4">
            <!-- Current User info & Logout -->
            <p>
                {{ $t("Current User") }}: <strong>{{ $root.username }}</strong>
                <button id="logout-btn" class="btn btn-danger ms-4 me-2 mb-2" @click="$root.logout">{{ $t("Logout") }}</button>
            </p>

            <!-- Change Username -->
            <h5 class="my-4 settings-subheading">{{ $t("Change Username") }}</h5>
            <form class="mb-5" @submit.prevent="saveUsername">
                <div class="mb-3">
                    <label for="new-username" class="form-label">
                        {{ $t("New Username") }}
                    </label>
                    <input
                        id="new-username"
                        v-model="newUsername"
                        type="text"
                        class="form-control"
                        required
                    />
                </div>

                <div class="mb-3">
                    <label for="username-password" class="form-label">
                        {{ $t("Current Password") }}
                    </label>
                    <input
                        id="username-password"
                        v-model="usernamePassword"
                        type="password"
                        class="form-control"
                        required
                    />
                </div>

                <div>
                    <button class="btn btn-primary" type="submit">
                        {{ $t("Update Username") }}
                    </button>
                </div>
            </form>

            <!-- Change Password -->
            <h5 class="my-4 settings-subheading">{{ $t("Change Password") }}</h5>
            <form class="mb-3" @submit.prevent="savePassword">
                <div class="mb-3">
                    <label for="current-password" class="form-label">
                        {{ $t("Current Password") }}
                    </label>
                    <input
                        id="current-password"
                        v-model="password.currentPassword"
                        type="password"
                        class="form-control"
                        autocomplete="current-password"
                        required
                    />
                </div>

                <div class="mb-3">
                    <label for="new-password" class="form-label">
                        {{ $t("New Password") }}
                    </label>
                    <input
                        id="new-password"
                        v-model="password.newPassword"
                        type="password"
                        class="form-control"
                        autocomplete="new-password"
                        required
                    />
                </div>

                <div class="mb-3">
                    <label for="repeat-new-password" class="form-label">
                        {{ $t("Repeat New Password") }}
                    </label>
                    <input
                        id="repeat-new-password"
                        v-model="password.repeatNewPassword"
                        type="password"
                        class="form-control"
                        :class="{ 'is-invalid': invalidPassword }"
                        autocomplete="new-password"
                        required
                    />
                    <div class="invalid-feedback">
                        {{ $t("passwordNotMatchMsg") }}
                    </div>
                </div>

                <div>
                    <button class="btn btn-primary" type="submit">
                        {{ $t("Update Password") }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            invalidPassword: false,
            newUsername: "",
            usernamePassword: "",
            password: {
                currentPassword: "",
                newPassword: "",
                repeatNewPassword: "",
            }
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

    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        },
    },

    methods: {
        /** Check new passwords match before saving them */
        savePassword() {
            if (this.password.newPassword !== this.password.repeatNewPassword) {
                this.invalidPassword = true;
            } else {
                this.$root
                    .getSocket()
                    .emit("changePassword", this.password, (res) => {
                        this.$root.toastRes(res);
                        if (res.ok) {
                            this.password.currentPassword = "";
                            this.password.newPassword = "";
                            this.password.repeatNewPassword = "";
                        }
                    });
            }
        },

        saveUsername() {
            this.$root.getSocket().emit("changeUsername", {
                newUsername: this.newUsername,
                currentPassword: this.usernamePassword,
            }, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.$root.username = this.newUsername;
                    this.newUsername = "";
                    this.usernamePassword = "";
                }
            });
        }
    },
};
</script>
