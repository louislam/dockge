import { defineComponent } from "vue";

export default defineComponent({
    data() {
        return {
            language: "en",
        };
    },

    watch: {
        async language(lang) {
            // No-op
        },
    },

    async created() {
        // No-op
    },

    methods: {
        async changeLang(lang : string) {
            // No-op
        }
    }
});
