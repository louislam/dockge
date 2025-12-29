import { R } from "redbean-node";
import { log } from "./log";
import { generatePasswordHash } from "./password-hash";
import { genSecret } from "../common/util-common";
import { User } from "./models/user";
import { IncomingHttpHeaders } from "http";

/**
 * Proxy Authentication Handler
 *
 * Supports authentication via HTTP headers set by reverse proxies like:
 * - Authentik (X-authentik-username)
 * - Authelia (Remote-User)
 * - OAuth2 Proxy (X-Auth-Request-User)
 * - Traefik Forward Auth (X-Forwarded-User)
 *
 * Common header names:
 * - Remote-User
 * - X-Forwarded-User
 * - X-Auth-Request-User
 * - X-authentik-username
 */

export class ProxyAuth {
    /**
     * Extract username from request headers based on configured header name
     * @param headers HTTP headers from the request
     * @param headerName The header name to look for (case-insensitive)
     * @returns The username if found, null otherwise
     */
    static extractUsername(headers: IncomingHttpHeaders, headerName: string): string | null {
        if (!headerName) {
            return null;
        }

        // Headers are lowercased by Node.js
        const normalizedHeader = headerName.toLowerCase();
        const value = headers[normalizedHeader];

        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }

        // Handle array case (multiple headers with same name)
        if (Array.isArray(value) && value.length > 0 && value[0].trim()) {
            return value[0].trim();
        }

        return null;
    }

    /**
     * Find an existing user by username
     * @param username Username to search for
     * @returns User if found, null otherwise
     */
    static async findUser(username: string): Promise<User | null> {
        const user = await R.findOne("user", " username = ? AND active = 1 ", [
            username,
        ]) as User | null;

        return user;
    }

    /**
     * Create a new user for proxy authentication
     * The user will have a random password since they authenticate via proxy
     * @param username Username to create
     * @returns The newly created user
     */
    static async createUser(username: string): Promise<User> {
        log.info("proxy-auth", `Auto-creating user: ${username}`);

        const user = R.dispense("user") as User;
        user.username = username;
        // Generate a random secure password - user won't need it since they auth via proxy
        user.password = generatePasswordHash(genSecret(32));
        user.active = true;
        // Mark as proxy-authenticated user (optional field for future use)
        await R.store(user);

        log.info("proxy-auth", `User created successfully: ${username} (ID: ${user.id})`);
        return user;
    }

    /**
     * Authenticate a user via proxy headers
     * Will find existing user or create new one if autoCreate is enabled
     * @param headers HTTP headers from the request
     * @param headerName The header name to look for
     * @param autoCreate Whether to auto-create users that don't exist
     * @returns User if authenticated, null otherwise
     */
    static async authenticate(
        headers: IncomingHttpHeaders,
        headerName: string,
        autoCreate: boolean
    ): Promise<User | null> {
        const username = this.extractUsername(headers, headerName);

        if (!username) {
            log.debug("proxy-auth", `No username found in header: ${headerName}`);
            return null;
        }

        log.info("proxy-auth", `Proxy auth attempt for user: ${username}`);

        // Try to find existing user
        let user = await this.findUser(username);

        if (user) {
            log.info("proxy-auth", `Found existing user: ${username}`);
            return user;
        }

        // User doesn't exist
        if (autoCreate) {
            user = await this.createUser(username);
            return user;
        }

        log.warn("proxy-auth", `User not found and auto-create disabled: ${username}`);
        return null;
    }

    /**
     * Get additional user info from common proxy headers
     * @param headers HTTP headers from the request
     * @returns Object containing email, name, groups if available
     */
    static extractUserInfo(headers: IncomingHttpHeaders): {
        email?: string;
        name?: string;
        groups?: string[];
    } {
        const info: { email?: string; name?: string; groups?: string[] } = {};

        // Common email headers
        const emailHeaders = [
            "x-forwarded-email",
            "x-auth-request-email",
            "x-authentik-email",
            "remote-email",
        ];
        for (const header of emailHeaders) {
            const value = headers[header];
            if (typeof value === "string" && value.trim()) {
                info.email = value.trim();
                break;
            }
        }

        // Common name headers
        const nameHeaders = [
            "x-forwarded-preferred-username",
            "x-auth-request-preferred-username",
            "x-authentik-name",
            "remote-name",
        ];
        for (const header of nameHeaders) {
            const value = headers[header];
            if (typeof value === "string" && value.trim()) {
                info.name = value.trim();
                break;
            }
        }

        // Common groups headers
        const groupsHeaders = [
            "x-forwarded-groups",
            "x-auth-request-groups",
            "x-authentik-groups",
            "remote-groups",
        ];
        for (const header of groupsHeaders) {
            const value = headers[header];
            if (typeof value === "string" && value.trim()) {
                info.groups = value.split(",").map(g => g.trim()).filter(g => g);
                break;
            }
        }

        return info;
    }
}

