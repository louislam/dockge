<template>
    <div class="form-container">
        <div class="form shadow-box m3-login-card">
            <form @submit.prevent="submit">
                <div class="d-flex justify-content-center mb-3">
                    <object class="bi" width="48" height="48" data="/icon.svg" />
                </div>
                <h2 class="h4 mb-4 fw-semibold text-center">{{ $t("Login") }}</h2>

                <div v-if="!tokenRequired" class="form-floating mb-3">
                    <input id="floatingInput" v-model="username" type="text" class="form-control" placeholder="Username" autocomplete="username" required>
                    <label for="floatingInput">{{ $t("Username") }}</label>
                </div>

                <div v-if="!tokenRequired" class="form-floating mb-3">
                    <input id="floatingPassword" v-model="password" type="password" class="form-control" placeholder="Password" autocomplete="current-password" required>
                    <label for="floatingPassword">{{ $t("Password") }}</label>
                </div>

                <div v-if="tokenRequired">
                    <div class="form-floating mb-3">
                        <input id="otp" v-model="token" type="text" maxlength="6" class="form-control" placeholder="123456" autocomplete="one-time-code" required>
                        <label for="otp">{{ $t("Token") }}</label>
                    </div>
                </div>

                <div class="form-check mb-4 d-flex justify-content-center align-items-center">
                    <input id="remember" v-model="$root.remember" type="checkbox" value="remember-me" class="form-check-input me-2">
                    <label class="form-check-label" for="remember">
                        {{ $t("Remember me") }}
                    </label>
                </div>
                <button class="w-100 btn btn-primary py-2" type="submit" :disabled="processing">
                    {{ $t("Login") }}
                </button>

                <div v-if="res && !res.ok" class="alert alert-danger mt-3" role="alert">
                    {{ $t(res.msg) }}
                </div>
            </form>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            processing: false,
            username: "",
            password: "",
            token: "",
            res: null,
            tokenRequired: false,
        };
    },

    mounted() {
        document.title += " - Login";
    },

    unmounted() {
        document.title = document.title.replace(" - Login", "");
    },

    methods: {
        /**
         * Submit the user details and attempt to log in
         * @returns {void}
         */
        submit() {
            this.processing = true;

            this.$root.login(this.username, this.password, this.token, (res) => {
                this.processing = false;

                if (res.tokenRequired) {
                    this.tokenRequired = true;
                } else {
                    this.res = res;
                }
            });
        },

    },
};
</script>

<style lang="scss" scoped>
.form-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 40px;
    padding-bottom: 40px;
    min-height: calc(100vh - 120px);

    @media (max-width: 575.98px) {
        padding-top: 20px;
        padding-bottom: 20px;
        min-height: calc(100vh - 80px);
    }
}

.m3-login-card {
    background-color: var(--m3-surface-container) !important;
    border: 1px solid rgba(120, 120, 120, 0.15) !important;
    border-radius: var(--m3-card-radius) !important;
    padding: 32px 24px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05) !important;
    width: 100%;
    max-width: 380px;
    margin: auto;
}

.form-floating {
    > label {
        padding-left: 1rem;
    }

    > .form-control {
        padding-left: 1rem;
    }
}
</style>
