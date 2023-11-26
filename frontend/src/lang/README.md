# Translations

A simple guide on how to translate `Dockge` in your native language.

## How to Translate

(11-26-2023) Updated

1. Go to <https://weblate.kuma.pet>
2. Register an account on Weblate
3. Make sure your GitHub email is matched with Weblate's account, so that it could show you as a contributor on GitHub
4. Choose your language on Weblate and start translating.

## How to add a new language in the dropdown

1. Add your Language at <https://weblate.kuma.pet/projects/dockge/dockge/>.
2. Find the language code (You can find it at the end of the URL)
3. Add your language at the end of `languageList` in `frontend/src/i18n.ts`, format: `"zh-TW": "繁體中文 (台灣)"`,
4. Commit to new branch and make a new Pull Request for me to approve.
