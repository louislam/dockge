import { defineComponent } from "vue";

export default defineComponent({
    data() {
        return {
            system: "dark",
            userTheme: "dark",
            statusPageTheme: "dark",
            forceStatusPageTheme: false,
            path: "",
        };
    },

    computed: {
        theme() {
            return "dark";
        },

        isDark() {
            return true;
        }
    },

    watch: {
        "$route.fullPath"(path) {
            this.path = path;
        },

        userTheme(to, from) {
            localStorage.theme = "dark";
        },

        styleElapsedTime(to, from) {
            localStorage.styleElapsedTime = to;
        },

        theme(to, from) {
            document.body.classList.remove(from);
            document.body.classList.add("dark");
            this.updateThemeColorMeta();
        },

        userHeartbeatBar(to, from) {
            localStorage.heartbeatBarTheme = to;
        },

        heartbeatBarTheme(to, from) {
            document.body.classList.remove(from);
            document.body.classList.add("dark");
        }
    },

    mounted() {
        this.userTheme = "dark";
        localStorage.theme = "dark";
        document.body.classList.add("dark");
        this.updateThemeColorMeta();
    },

    methods: {
        /**
         * Update the theme color meta tag
         * @returns {void}
         */
        updateThemeColorMeta() {
            const meta = document.querySelector("#theme-color");
            if (meta) {
                meta.setAttribute("content", "#161B22");
            }
        }
    }
});

