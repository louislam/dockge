import { log } from "./log";
import compareVersions from "compare-versions";
import packageJSON from "../package.json";
import { Settings } from "./settings";

export const obj = {
    version: packageJSON.version,
    latestVersion: null,
};
export default obj;

// How much time in ms to wait between update checks
const UPDATE_CHECKER_INTERVAL_MS = 1000 * 60 * 60 * 48;
const CHECK_URL = "https://dockge.kuma.pet/version";

let interval : NodeJS.Timeout;

export function startInterval() {
    const check = async () => {
        if (await Settings.get("checkUpdate") === false) {
            return;
        }

        log.debug("update-checker", "Retrieving latest versions");

        try {
            const res = await fetch(CHECK_URL);
            const data = await res.json();

            // For debug
            if (process.env.TEST_CHECK_VERSION === "1") {
                data.slow = "1000.0.0";
            }

            const checkBeta = await Settings.get("checkBeta");

            if (checkBeta && data.beta) {
                if (compareVersions.compare(data.beta, data.slow, ">")) {
                    obj.latestVersion = data.beta;
                    return;
                }
            }

            if (data.slow) {
                obj.latestVersion = data.slow;
            }

        } catch (_) {
            log.info("update-checker", "Failed to check for new versions");
        }

    };

    check();
    interval = setInterval(check, UPDATE_CHECKER_INTERVAL_MS);
}

/**
 * Enable the check update feature
 * @param value Should the check update feature be enabled?
 * @returns
 */
export async function enableCheckUpdate(value : boolean) {
    await Settings.set("checkUpdate", value);

    clearInterval(interval);

    if (value) {
        startInterval();
    }
}
