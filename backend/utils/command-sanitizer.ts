/**
 * Command Sanitizer for Terminal Input
 * Prevents shell injection attacks by validating and sanitizing terminal input
 */

/**
 * List of allowed shell metacharacters that are safe in a shell context
 * These are typically only used for navigation, not for command injection
 */
const DANGEROUS_METACHARACTERS = [
    '|',      // Pipe - command chaining
    '&',      // Background/AND - command chaining
    ';',      // Command separator (except in quoted context)
    '`',      // Command substitution
    '$',      // Variable expansion
    '(',      // Subshell
    ')',      // Subshell end
    '{',      // Brace expansion
    '}',      // Brace expansion end
    '<',      // Input redirection
    '>',      // Output redirection
    '\\',     // Escape character
    '"',      // Double quote
    "'",      // Single quote
    '\n',     // Newline
    '\r',     // Carriage return
];

/**
 * Validates if a command input contains dangerous shell metacharacters
 * Returns true if the command is SAFE (no dangerous metacharacters)
 * Returns false if the command is UNSAFE (contains dangerous metacharacters)
 * 
 * @param cmd The command string to validate
 * @param strict If true, validates more strictly (default: true)
 * @returns true if safe, false if unsafe
 */
export function isCommandSafe(cmd: string, strict: boolean = true): boolean {
    if (typeof cmd !== 'string') {
        return false;
    }

    // Check for dangerous metacharacters
    for (const char of DANGEROUS_METACHARACTERS) {
        if (cmd.includes(char)) {
            return false;
        }
    }

    // Additional check: look for common injection patterns
    if (strict) {
        // Check for known injection patterns
        const injectionPatterns = [
            /\$\{/,           // ${...} parameter expansion
            /\$\(/,           // $(...) command substitution
            /&&/,             // && operator
            /\|\|/,           // || operator
            /&>/,             // Output redirection
            /2>&1/,           // Error redirection
            /\r?\n/,          // Line breaks
        ];

        for (const pattern of injectionPatterns) {
            if (pattern.test(cmd)) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Escapes shell metacharacters in a string for safe execution
 * This function wraps the input in quotes and escapes any quote characters
 * 
 * @param cmd The command string to escape
 * @returns The escaped command string
 */
export function escapeShellCommand(cmd: string): string {
    if (typeof cmd !== 'string') {
        return '';
    }

    // Escape single quotes by replacing ' with '\'' (end quote, escaped quote, start quote)
    const escaped = cmd.replace(/'/g, "'\\''");
    
    // Wrap in single quotes for safety (single quotes preserve literal value of all characters)
    return `'${escaped}'`;
}

/**
 * Parses a command input and validates it for safe execution
 * Splits the command into arguments while respecting quoted strings
 * 
 * @param cmd The command string to parse
 * @returns Array of command parts if valid, null if invalid/unsafe
 */
export function parseCommandSafely(cmd: string): string[] | null {
    if (typeof cmd !== 'string' || cmd.trim() === '') {
        return null;
    }

    // First check: is the command safe at all?
    if (!isCommandSafe(cmd, true)) {
        return null;
    }

    // Simple split by whitespace (since we've already validated no dangerous chars)
    const parts = cmd.trim().split(/\s+/);

    // Validate each part
    for (const part of parts) {
        if (part.length === 0) {
            continue;
        }
        
        // Double-check each part is safe
        if (!isCommandSafe(part, true)) {
            return null;
        }
    }

    return parts.filter(p => p.length > 0);
}

/**
 * Validates if a command is in the allowed command list
 * For terminal console, only certain commands are allowed: docker, ls, cd, pwd, clear, etc.
 * 
 * @param cmd The command to validate
 * @param allowedCommands List of allowed commands
 * @returns true if command is in the allowed list, false otherwise
 */
export function isCommandAllowed(cmd: string, allowedCommands: string[]): boolean {
    if (typeof cmd !== 'string') {
        return false;
    }

    const cmdName = cmd.trim().split(/\s+/)[0].toLowerCase();
    return allowedCommands.some(allowed => cmdName === allowed.toLowerCase());
}

/**
 * Default allowed commands for the main terminal console
 * These are safe commands that don't allow arbitrary execution
 */
export const DEFAULT_ALLOWED_COMMANDS = [
    'docker',
    'docker-compose',
    'docker compose',
    'ls',
    'cd',
    'pwd',
    'clear',
    'echo',
    'cat',
    'grep',
    'find',
    'head',
    'tail',
    'wc',
    'file',
    'stat',
    'tree',
];
