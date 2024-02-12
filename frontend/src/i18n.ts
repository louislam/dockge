// @ts-ignore Performance issue when using "vue-i18n", so we use "vue-i18n/dist/vue-i18n.esm-browser.prod.js", but typescript doesn't like that.
import { createI18n } from "vue-i18n/dist/vue-i18n.esm-browser.prod.js";
import en from "./lang/en.json";

const languageList = {
    "bg-BG": "Български",
    "es": "Español",
    "de": "Deutsch",
    "fr": "Français",
    "pl-PL": "Polski",
    "pt": "Português",
    "pt-BR": "Português-Brasil",
    "sl": "Slovenščina",
    "tr": "Türkçe",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文(台灣)",
    "ur": "Urdu",
    "ko-KR": "한국어",
    "ru": "Русский",
    "cs-CZ": "Čeština",
    "ar": "العربية",
    "th": "ไทย",
    "it-IT": "Italiano",
    "sv-SE": "Svenska",
    "uk-UA": "Українська",
    "da": "Dansk",
    "ja": "日本語",
    "nl": "Nederlands",
    "ro": "Română",
    "id": "Bahasa Indonesia (Indonesian)",
    "vi": "Tiếng Việt",
    "hu": "Magyar",
    "ca": "Català",
    "ga": "Gaeilge",
};

let messages = {
    en,
};

for (let lang in languageList) {
    messages[lang] = {
        languageName: languageList[lang]
    };
}

const rtlLangs = [ "fa", "ar-SY", "ur", "ar" ];

export const currentLocale = () => localStorage.locale
    || languageList[navigator.language] && navigator.language
    || languageList[navigator.language.substring(0, 2)] && navigator.language.substring(0, 2)
    || "en";

export const localeDirection = () => {
    return rtlLangs.includes(currentLocale()) ? "rtl" : "ltr";
};

export const i18n = createI18n({
    locale: currentLocale(),
    fallbackLocale: "en",
    silentFallbackWarn: true,
    silentTranslationWarn: true,
    messages: messages,
});
