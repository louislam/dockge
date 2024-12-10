/*
 * Common utilities for backend and frontend
 */
import yaml, { Document, Pair, Scalar } from "yaml";
import { DotenvParseOutput } from "dotenv";

// Init dayjs
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
// @ts-ignore
import { replaceVariablesSync } from "@inventage/envsubst";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export interface LooseObject {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
}

export interface BaseRes {
    ok: boolean;
    msg?: string;
}

let randomBytes : (numBytes: number) => Uint8Array;
initRandomBytes();

async function initRandomBytes() {
    if (typeof window !== "undefined" && window.crypto) {
        randomBytes = function randomBytes(numBytes: number) {
            const bytes = new Uint8Array(numBytes);
            for (let i = 0; i < numBytes; i += 65536) {
                window.crypto.getRandomValues(bytes.subarray(i, i + Math.min(numBytes - i, 65536)));
            }
            return bytes;
        };
    } else {
        randomBytes = (await import("node:crypto")).randomBytes;
    }
}

export const ALL_ENDPOINTS = "##ALL_DOCKGE_ENDPOINTS##";

// Stack Status
export const UNKNOWN = 0;
export const CREATED_FILE = 1;
export const CREATED_STACK = 2;
export const RUNNING = 3;
export const EXITED = 4;

export function statusName(status : number) : string {
    switch (status) {
        case CREATED_FILE:
            return "draft";
        case CREATED_STACK:
            return "created_stack";
        case RUNNING:
            return "running";
        case EXITED:
            return "exited";
        default:
            return "unknown";
    }
}

export function statusNameShort(status : number) : string {
    switch (status) {
        case CREATED_FILE:
            return "inactive";
        case CREATED_STACK:
            return "inactive";
        case RUNNING:
            return "active";
        case EXITED:
            return "exited";
        default:
            return "?";
    }
}

export function statusColor(status : number) : string {
    switch (status) {
        case CREATED_FILE:
            return "dark";
        case CREATED_STACK:
            return "dark";
        case RUNNING:
            return "primary";
        case EXITED:
            return "danger";
        default:
            return "secondary";
    }
}

export const isDev = process.env.NODE_ENV === "development";
export const TERMINAL_COLS = 105;
export const TERMINAL_ROWS = 10;
export const PROGRESS_TERMINAL_ROWS = 8;

export const COMBINED_TERMINAL_COLS = 58;
export const COMBINED_TERMINAL_ROWS = 20;

export const ERROR_TYPE_VALIDATION = 1;

export const allowedCommandList : string[] = [
    "docker",
    "ls",
    "cd",
    "dir",
];

export const allowedRawKeys = [
    "\u0003", // Ctrl + C
];

export const acceptedComposeFileNames = [
    "compose.yaml",
    "docker-compose.yaml",
    "docker-compose.yml",
    "compose.yml",
];

/**
 * Generate a decimal integer number from a string
 * @param str Input
 * @param length Default is 10 which means 0 - 9
 */
export function intHash(str : string, length = 10) : number {
    // A simple hashing function (you can use more complex hash functions if needed)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
    }
    // Normalize the hash to the range [0, 10]
    return (hash % length + length) % length; // Ensure the result is non-negative
}

/**
 * Delays for specified number of seconds
 * @param ms Number of milliseconds to sleep for
 */
export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random alphanumeric string of fixed length
 * @param length Length of string to generate
 * @returns string
 */
export function genSecret(length = 64) {
    let secret = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charsLength = chars.length;
    for ( let i = 0; i < length; i++ ) {
        secret += chars.charAt(getCryptoRandomInt(0, charsLength - 1));
    }
    return secret;
}

/**
 * Get a random integer suitable for use in cryptography between upper
 * and lower bounds.
 * @param min Minimum value of integer
 * @param max Maximum value of integer
 * @returns Cryptographically suitable random integer
 */
export function getCryptoRandomInt(min: number, max: number):number {
    // synchronous version of: https://github.com/joepie91/node-random-number-csprng

    const range = max - min;
    if (range >= Math.pow(2, 32)) {
        console.log("Warning! Range is too large.");
    }

    let tmpRange = range;
    let bitsNeeded = 0;
    let bytesNeeded = 0;
    let mask = 1;

    while (tmpRange > 0) {
        if (bitsNeeded % 8 === 0) {
            bytesNeeded += 1;
        }
        bitsNeeded += 1;
        mask = mask << 1 | 1;
        tmpRange = tmpRange >>> 1;
    }

    const bytes = randomBytes(bytesNeeded);
    let randomValue = 0;

    for (let i = 0; i < bytesNeeded; i++) {
        randomValue |= bytes[i] << 8 * i;
    }

    randomValue = randomValue & mask;

    if (randomValue <= range) {
        return min + randomValue;
    } else {
        return getCryptoRandomInt(min, max);
    }
}

export function getComposeTerminalName(endpoint : string, stack : string) {
    return "compose-" + endpoint + "-" + stack;
}

export function getCombinedTerminalName(endpoint : string, stack : string) {
    return "combined-" + endpoint + "-" + stack;
}

export function getContainerTerminalName(endpoint : string, container : string) {
    return "container-" + endpoint + "-" + container;
}

export function getContainerExecTerminalName(endpoint : string, stackName : string, container : string, index : number) {
    return "container-exec-" + endpoint + "-" + stackName + "-" + container + "-" + index;
}

export function copyYAMLComments(doc : Document, src : Document) {
    doc.comment = src.comment;
    doc.commentBefore = src.commentBefore;

    if (doc && doc.contents && src && src.contents) {
        // @ts-ignore
        copyYAMLCommentsItems(doc.contents.items, src.contents.items);
    }
}

/**
 * Copy yaml comments from srcItems to items
 * Attempts to preserve comments by matching content rather than just array indices
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function copyYAMLCommentsItems(items: any, srcItems: any) {
    if (!items || !srcItems) {
        return;
    }

    // First pass - try to match items by their content
    for (let i = 0; i < items.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item: any = items[i];

        // Try to find matching source item by content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const srcIndex = srcItems.findIndex((srcItem: any) =>
            JSON.stringify(srcItem.value) === JSON.stringify(item.value) &&
            JSON.stringify(srcItem.key) === JSON.stringify(item.key)
        );

        if (srcIndex !== -1) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const srcItem: any = srcItems[srcIndex];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nextSrcItem: any = srcItems[srcIndex + 1];

            if (item.key && srcItem.key) {
                item.key.comment = srcItem.key.comment;
                item.key.commentBefore = srcItem.key.commentBefore;
            }

            if (srcItem.comment) {
                item.comment = srcItem.comment;
            }

            // Handle comments between array items
            if (nextSrcItem && nextSrcItem.commentBefore) {
                if (items[i + 1]) {
                    items[i + 1].commentBefore = nextSrcItem.commentBefore;
                }
            }

            // Handle trailing comments after array items
            if (srcItem.value && srcItem.value.comment) {
                if (item.value) {
                    item.value.comment = srcItem.value.comment;
                }
            }

            if (item.value && srcItem.value) {
                if (typeof item.value === "object" && typeof srcItem.value === "object") {
                    item.value.comment = srcItem.value.comment;
                    item.value.commentBefore = srcItem.value.commentBefore;

                    if (item.value.items && srcItem.value.items) {
                        copyYAMLCommentsItems(item.value.items, srcItem.value.items);
                    }
                }
            }
        }
    }
}

/**
 * Possible Inputs:
 * ports:
 *   - "3000"
 *   - "3000-3005"
 *   - "8000:8000"
 *   - "9090-9091:8080-8081"
 *   - "49100:22"
 *   - "8000-9000:80"
 *   - "127.0.0.1:8001:8001"
 *   - "127.0.0.1:5000-5010:5000-5010"
 *   - "6060:6060/udp"
 * @param input
 * @param hostname
 */
export function parseDockerPort(input : string, hostname : string) {
    let port;
    let display;

    const parts = input.split("/");
    const part1 = parts[0];
    let protocol = parts[1] || "tcp";

    // Split the last ":"
    const lastColon = part1.lastIndexOf(":");

    if (lastColon === -1) {
        // No colon, so it's just a port or port range
        // Check if it's a port range
        const dash = part1.indexOf("-");
        if (dash === -1) {
            // No dash, so it's just a port
            port = part1;
        } else {
            // Has dash, so it's a port range, use the first port
            port = part1.substring(0, dash);
        }

        display = part1;

    } else {
        // Has colon, so it's a port mapping
        let hostPart = part1.substring(0, lastColon);
        display = hostPart;

        // Check if it's a port range
        const dash = part1.indexOf("-");

        if (dash !== -1) {
            // Has dash, so it's a port range, use the first port
            hostPart = part1.substring(0, dash);
        }

        // Check if it has a ip (ip:port)
        const colon = hostPart.indexOf(":");

        if (colon !== -1) {
            // Has colon, so it's a ip:port
            hostname = hostPart.substring(0, colon);
            port = hostPart.substring(colon + 1);
        } else {
            // No colon, so it's just a port
            port = hostPart;
        }
    }

    let portInt = parseInt(port);

    if (portInt == 443) {
        protocol = "https";
    } else if (protocol === "tcp") {
        protocol = "http";
    }

    return {
        url: protocol + "://" + hostname + ":" + portInt,
        display: display,
    };
}

export function envsubst(string : string, variables : LooseObject) : string {
    return replaceVariablesSync(string, variables)[0];
}

/**
 * Traverse all values in the yaml and for each value, if there are template variables, replace it environment variables
 * Emulates the behavior of how docker-compose handles environment variables in yaml files
 * @param content Yaml string
 * @param env Environment variables
 * @returns string Yaml string with environment variables replaced
 */
export function envsubstYAML(content : string, env : DotenvParseOutput) : string {
    const doc = yaml.parseDocument(content);
    if (doc.contents) {
        // @ts-ignore
        for (const item of doc.contents.items) {
            traverseYAML(item, env);
        }
    }
    return doc.toString();
}

/**
 * Used for envsubstYAML(...)
 * @param pair
 * @param env
 */
function traverseYAML(pair : Pair, env : DotenvParseOutput) : void {
    // @ts-ignore
    if (pair.value && pair.value.items) {
        // @ts-ignore
        for (const item of pair.value.items) {
            if (item instanceof Pair) {
                traverseYAML(item, env);
            } else if (item instanceof Scalar) {
                let value = item.value as unknown;

                if (typeof(value) === "string") {
                    item.value = envsubst(value, env);
                }
            }
        }
    // @ts-ignore
    } else if (pair.value && typeof(pair.value.value) === "string") {
        // @ts-ignore
        pair.value.value = envsubst(pair.value.value, env);
    }
}

