/*
 * Original Source: https://github.com/inventage/envsubst/blob/main/src/utils.js
 * MIT License
 * Copyright (c) 2021 Inventage AG
 *
 * Copy this file, because
 */
import escapeStringRegexp from "escape-string-regexp";
import { LooseObject } from "./util-common";

const toLowerKeys = (object : LooseObject) => {
    return Object.keys(object).reduce((accumulator : LooseObject, key) => {
        accumulator[key.toLowerCase()] = object[key];
        return accumulator;
    }, {});
};

/**
 * Regex pattern with an optional prefix.
 *
 * @see https://regex101.com/r/M3dVAW/1
 * @param prefix
 * @returns {string}
 */
const variableRegexPattern = (prefix = ""): string => {
    return `\\\${(${prefix ? escapeStringRegexp(prefix) : ""}\\w+)(:-([^}]*))?}`;
};

/**
 * Regex pattern that wraps the variable regex pattern with a window variable statement:
 *
 *     window['${VAR}'] or window["${VAR}"]
 *
 * @see https://regex101.com/r/ND057d/1
 * @param prefix
 * @returns {string}
 */
const windowVariableRegexPattern = (prefix = ""): string => {
    return `(window\\[['"]{1})?${variableRegexPattern(prefix)}(['"]{1}\\])?`;
};

/**
 * Replaces all variable placeholders in the given string with either variable values
 * found in the variables parameter OR with the given default in the variable string.
 *
 * @param {string} string
 * @param {object} variables
 * @param {string} prefix
 * @param {boolean} trimWindow
 * @param {boolean} ignoreCase
 * @returns {Promise<unknown[]>}
 */
const replaceVariables = (string: string, variables: object = {}, prefix: string = "", trimWindow: boolean = false, ignoreCase: boolean = false): Promise<unknown[]> =>
    new Promise(resolve => {
        resolve(replaceVariablesSync(string, variables, prefix, trimWindow, ignoreCase));
    });

/**
 * Replaces all variable placeholders in the given string with either variable values
 * found in the variables parameter OR with the given default in the variable string.
 *
 * @param {string} string
 * @param {object} variables
 * @param {string} prefix
 * @param {boolean} trimWindow
 * @param {boolean} ignoreCase
 * @returns {unknown[]}
 */
const replaceVariablesSync = (string : string, variables: LooseObject = {}, prefix: string = "", trimWindow: boolean = false, ignoreCase: boolean = false): unknown[] => {
    const regex = new RegExp(trimWindow ? windowVariableRegexPattern(prefix) : variableRegexPattern(prefix), ignoreCase ? "gmi" : "gm");
    const matches = [ ...string.matchAll(regex) ];
    const lowercaseVariables = toLowerKeys(variables);

    let replaced = string;
    const replacements : LooseObject[] = [];
    for (const match of matches) {
        if (trimWindow) {
            const [ original, windowStart, name, , fallback, windowEnd ] = match;

            // Bail if the match does not contain `^window[`
            if (!windowStart) {
                continue;
            }

            const valueStartQuote = windowStart.replace("window[", "");
            const valueEndQuote = windowEnd.replace("]", "");
            const withoutWindow = original.replace(windowStart, "").replace(windowEnd, "");

            let value;
            if (ignoreCase) {
                value = Object.hasOwnProperty.call(lowercaseVariables || {}, name.toLowerCase()) ? lowercaseVariables[name.toLowerCase()] : fallback;
            } else {
                value = Object.hasOwnProperty.call(variables || {}, name) ? variables[name] : fallback;
            }

            if (value !== undefined) {
                const quotedValue = `${valueStartQuote}${value}${valueEndQuote}`;
                const replacement = replacements.find(r => r.from === original && r.to === quotedValue);
                if (replacement) {
                    replacement.count = replacement.count + 1;
                } else {
                    replacements.push({ from: original,
                        to: quotedValue,
                        count: 1 });
                }

                replaced = replaced.split(original).join(withoutWindow.split(withoutWindow).join(quotedValue));
            }
        } else {
            const [ original, name, , fallback ] = match;

            let value : string;
            if (ignoreCase) {
                value = Object.hasOwnProperty.call(lowercaseVariables || {}, name.toLowerCase()) ? lowercaseVariables[name.toLowerCase()] : fallback;
            } else {
                value = Object.hasOwnProperty.call(variables || {}, name) ? variables[name] : fallback;
            }

            if (value !== undefined) {
                const replacement = replacements.find(r => r.from === original && r.to === value);
                if (replacement) {
                    replacement.count = replacement.count + 1;
                } else {
                    replacements.push({ from: original,
                        to: value,
                        count: 1 });
                }

                replaced = replaced.split(original).join(value);
            }
        }
    }

    return [ replaced, replacements ];
};



export { variableRegexPattern, replaceVariables, replaceVariablesSync };
