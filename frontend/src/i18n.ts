// @ts-ignore Performance issue when using "vue-i18n", so we use "vue-i18n/dist/vue-i18n.esm-browser.prod.js", but typescript doesn't like that.
import { createI18n } from "vue-i18n/dist/vue-i18n.esm-browser.prod.js";
import en from "./lang/en.json";

const languageList = {
    "en": "English",
};

let messages = {
    en,
};

export const currentLocale = () => "en";

export const localeDirection = () => "ltr";

export const i18n = createI18n({
    locale: "en",
    fallbackLocale: "en",
    silentFallbackWarn: true,
    silentTranslationWarn: true,
    messages: messages,
});
