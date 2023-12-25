// Dayjs init inside this, so it has to be the first import
import "../../common/util-common";

import { createApp, defineComponent, h } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { FontAwesomeIcon } from "./icon.js";
import { i18n } from "./i18n";

// Dependencies
import "bootstrap";
import Toast, { POSITION, useToast } from "vue-toastification";
import "@xterm/xterm/lib/xterm.js";

// CSS
import "@fontsource/jetbrains-mono";
import "vue-toastification/dist/index.css";
import "@xterm/xterm/css/xterm.css";
import "./styles/main.scss";

// Minxins
import socket from "./mixins/socket";
import lang from "./mixins/lang";
import theme from "./mixins/theme";

// Set Title
document.title = document.title + " - " + location.host;

const app = createApp(rootApp());

app.use(Toast, {
    position: POSITION.BOTTOM_RIGHT,
    showCloseButtonOnHover: true,
});
app.use(router);
app.use(i18n);
app.component("FontAwesomeIcon", FontAwesomeIcon);
app.mount("#app");

/**
 * Root Vue component
 */
function rootApp() {
    const toast = useToast();

    return defineComponent({
        mixins: [
            socket,
            lang,
            theme,
        ],
        data() {
            return {
                loggedIn: false,
                allowLoginDialog: false,
                username: null,
            };
        },
        computed: {

        },
        methods: {

            /**
             * Show success or error toast dependant on response status code
             * @param {object} res Response object
             * @returns {void}
             */
            toastRes(res) {
                let msg = res.msg;
                if (res.msgi18n) {
                    if (msg != null && typeof msg === "object") {
                        msg = this.$t(msg.key, msg.values);
                    } else {
                        msg = this.$t(msg);
                    }
                }

                if (res.ok) {
                    toast.success(msg);
                } else {
                    toast.error(msg);
                }
            },
            /**
             * Show a success toast
             * @param {string} msg Message to show
             * @returns {void}
             */
            toastSuccess(msg : string) {
                toast.success(this.$t(msg));
            },

            /**
             * Show an error toast
             * @param {string} msg Message to show
             * @returns {void}
             */
            toastError(msg : string) {
                toast.error(this.$t(msg));
            },
        },
        render: () => h(App),
    });
}
