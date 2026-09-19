import { defineComponent } from "vue";

export default defineComponent({
    data() {
        return {
            system: (window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light",
            userTheme: localStorage.theme,
            statusPageTheme: "light",
            forceStatusPageTheme: false,
            path: "",
            viewportWidth: window.innerWidth,
        };
    },

    computed: {
        theme() {
            if (this.userTheme === "auto") {
                return this.system;
            }
            return this.userTheme;
        },

        isDark() {
            return this.theme === "dark";
        },

        isMobile() {
            return this.viewportWidth < 768;
        },

        isTablet() {
            return this.viewportWidth >= 768 && this.viewportWidth < 992;
        },

        isCompact() {
            return this.viewportWidth < 992;
        },
    },

    watch: {
        "$route.fullPath"(path) {
            this.path = path;
        },

        userTheme(to, from) {
            localStorage.theme = to;
        },

        styleElapsedTime(to, from) {
            localStorage.styleElapsedTime = to;
        },

        theme(to, from) {
            document.body.classList.remove(from);
            document.body.classList.add(this.theme);
            this.updateThemeColorMeta();
        },

        userHeartbeatBar(to, from) {
            localStorage.heartbeatBarTheme = to;
        },

        heartbeatBarTheme(to, from) {
            document.body.classList.remove(from);
            document.body.classList.add(this.heartbeatBarTheme);
        }
    },

    mounted() {
        // Default Dark
        if (! this.userTheme) {
            this.userTheme = "dark";
        }

        document.body.classList.add(this.theme);
        this.updateThemeColorMeta();
        window.addEventListener("resize", this.updateViewportWidth, { passive: true });
    },

    beforeUnmount() {
        window.removeEventListener("resize", this.updateViewportWidth);
    },

    methods: {
        /**
         * Update the theme color meta tag
         * @returns {void}
         */
        updateThemeColorMeta() {
            if (this.theme === "dark") {
                document.querySelector("#theme-color").setAttribute("content", "#161B22");
            } else {
                document.querySelector("#theme-color").setAttribute("content", "#5cdd8b");
            }
        },

        updateViewportWidth() {
            this.viewportWidth = window.innerWidth;
        },
    }
});

