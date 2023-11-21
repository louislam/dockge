# Translations

A simple guide on how to translate `Dockge` in your native language.

## How to add a new language in the dropdown

(11-21-2023) Updated

1. Add your Language at `frontend/src/lang/` by creating a new file with your language Code, format: `zh-TW.json` .
2. Copy the content from `en.json` and make translations from that.
3. Add your language at the end of `languageList` in `frontend/src/i18n.ts`, format: `"zh-TW": "繁體中文 (台灣)"`,
4. Commit to new branch and make a new Pull Request for me to approve.

*Note:* Currently we are only accepting one Pull Request per Language Translate.
