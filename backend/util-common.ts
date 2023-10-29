/*
 * Common utilities for backend and frontend
 */

// Init dayjs
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

let randomBytes : (numBytes: number) => Uint8Array;

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
            return "draft";
        case CREATED_STACK:
            return "inactive";
        case RUNNING:
            return "active";
        case EXITED:
            return "inactive";
        default:
            return "?";
    }
}

export function statusColor(status : number) : string {
    switch (status) {
        case CREATED_FILE:
            return "dark";
        case CREATED_STACK:
            return "danger";
        case RUNNING:
            return "primary";
        case EXITED:
            return "danger";
        default:
            return "secondary";
    }
}

export const isDev = process.env.NODE_ENV === "development";
export const TERMINAL_COLS = 80;
export const TERMINAL_ROWS = 10;
export const PROGRESS_TERMINAL_ROWS = 8;

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

export function getComposeTerminalName(stack : string) {
    return "compose-" + stack;
}

export function getContainerTerminalName(container : string) {
    return "container-" + container;
}

export function getContainerExecTerminalName(container : string, index : number) {
    return "container-exec-" + container + "-" + index;
}

