// @ts-ignore
import composerize from "composerize";
import { SocketHandler } from "../socket-handler.js";
import { DockgeServer } from "../dockge-server";
import { log } from "../log";
import { R } from "redbean-node";
import { loginRateLimiter, twoFaRateLimiter } from "../rate-limiter";
import { generatePasswordHash, needRehashPassword, shake256, SHAKE256_LENGTH, verifyPassword } from "../password-hash";
import { User } from "../models/user";
import {
    callbackError,
    checkLogin,
    DockgeSocket,
    doubleCheckPassword,
    JWTDecoded,
    ValidationError
} from "../util-server";
import { passwordStrength } from "check-password-strength";
import jwt from "jsonwebtoken";
import { Settings } from "../settings";

async function verifyTurnstileToken(token: string, clientIP: string, secretKey: string): Promise<boolean> {
    if (!token) {
        console.error("Token is not provided.");
        return false;
    }

    const url = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    const result = await fetch(url, {
        body: JSON.stringify({
            secret: secretKey,
            response: token,
            remoteip: clientIP
        }),
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    });
    const outcome = await result.json();
    if (outcome && outcome.success) {
        console.log("Token verified successfully:", outcome);
        return true;
    }
    console.error("Token verification failed:", outcome["error-codes"]);
    return false;

}

export class MainSocketHandler extends SocketHandler {
    create(socket : DockgeSocket, server : DockgeServer) {

        // ***************************
        // Public Socket API
        // ***************************

        // Setup
        socket.on("setup", async (username, password, callback) => {
            try {
                if (passwordStrength(password).value === "Too weak") {
                    throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                }

                if ((await R.knex("user").count("id as count").first()).count !== 0) {
                    throw new Error("Dockge has been initialized. If you want to run setup again, please delete the database.");
                }

                const user = R.dispense("user");
                user.username = username;
                user.password = generatePasswordHash(password);
                await R.store(user);

                server.needSetup = false;

                callback({
                    ok: true,
                    msg: "successAdded",
                    msgi18n: true,
                });

            } catch (e) {
                if (e instanceof Error) {
                    callback({
                        ok: false,
                        msg: e.message,
                    });
                }
            }
        });

        // New event to fetch the Turnstile site key
        socket.on("getTurnstileSiteKey", async (callback) => {
            try {
                const siteKey = process.env.TURNSTILE_SITE_KEY || "";
                console.log("Turnstile site key from env:", siteKey);
                // Checking
                if (typeof callback !== "function") {
                    return;
                }
                if (!siteKey) {
                    log.warn("auth", "Turnstile site key is not configured in the environment.");
                    callback({
                        ok: false,
                        msg: "Turnstile site key is not configured.",
                    });
                    return;
                }

                callback({
                    ok: true,
                    siteKey: siteKey,
                });
            } catch (error) {
                log.error("Error fetching Turnstile site key:", error);
                callback({
                    ok: false,
                    msg: "Failed to fetch Turnstile site key.",
                });
            }
        });

        // Login by token
        socket.on("loginByToken", async (token, callback) => {
            const clientIP = await server.getClientIP(socket);

            log.info("auth", `Login by token. IP=${clientIP}`);

            try {
                const decoded = jwt.verify(token, server.jwtSecret) as JWTDecoded;

                log.info("auth", "Username from JWT: " + decoded.username);

                const user = await R.findOne("user", " username = ? AND active = 1 ", [
                    decoded.username,
                ]) as User;

                if (user) {
                    // Check if the password changed
                    if (decoded.h !== shake256(user.password, SHAKE256_LENGTH)) {
                        throw new Error("The token is invalid due to password change or old token");
                    }

                    log.debug("auth", "afterLogin");
                    await server.afterLogin(socket, user);
                    log.debug("auth", "afterLogin ok");

                    log.info("auth", `Successfully logged in user ${decoded.username}. IP=${clientIP}`);

                    callback({
                        ok: true,
                    });
                } else {

                    log.info("auth", `Inactive or deleted user ${decoded.username}. IP=${clientIP}`);

                    callback({
                        ok: false,
                        msg: "authUserInactiveOrDeleted",
                        msgi18n: true,
                    });
                }
            } catch (error) {
                if (!(error instanceof Error)) {
                    console.error("Unknown error:", error);
                    return;
                }
                log.error("auth", `Invalid token. IP=${clientIP}`);
                if (error.message) {
                    log.error("auth", error.message + ` IP=${clientIP}`);
                }
                callback({
                    ok: false,
                    msg: "authInvalidToken",
                    msgi18n: true,
                });
            }

        });

        // Login
        socket.on("login", async (data, callback) => {
            const clientIP = await server.getClientIP(socket);

            log.info("auth", `Login by username + password. IP=${clientIP}`);

            const siteKey = process.env.TURNSTILE_SITE_KEY || "";
            const secretKey = process.env.TURNSTILE_SECRET_KEY || "";
            if (siteKey && secretKey) {
                // Verify Turnstile token
                const isCaptchaValid = await verifyTurnstileToken(data.captchaToken, clientIP, secretKey);
                if (!isCaptchaValid) {
                    return callback({
                        ok: false,
                        msg: "Invalid CAPTCHA"
                    });
                }
            } else {
                log.warn("auth", "Turnstile keys are not configured. Skipping CAPTCHA verification.");
            }

            // Checking
            if (typeof callback !== "function") {
                return;
            }

            if (!data) {
                return;
            }

            // Login Rate Limit
            if (!await loginRateLimiter.pass(callback)) {
                log.info("auth", `Too many failed requests for user ${data.username}. IP=${clientIP}`);
                return;
            }

            const user = await this.login(data.username, data.password);

            if (user) {
                if (user.twofa_status === 0) {
                    server.afterLogin(socket, user);

                    log.info("auth", `Successfully logged in user ${data.username}. IP=${clientIP}`);

                    callback({
                        ok: true,
                        token: User.createJWT(user, server.jwtSecret),
                    });
                }

                if (user.twofa_status === 1 && !data.token) {

                    log.info("auth", `2FA token required for user ${data.username}. IP=${clientIP}`);

                    callback({
                        tokenRequired: true,
                    });
                }

                if (data.token) {
                    // @ts-ignore
                    const verify = notp.totp.verify(data.token, user.twofa_secret, twoFAVerifyOptions);

                    if (user.twofa_last_token !== data.token && verify) {
                        server.afterLogin(socket, user);

                        await R.exec("UPDATE `user` SET twofa_last_token = ? WHERE id = ? ", [
                            data.token,
                            socket.userID,
                        ]);

                        log.info("auth", `Successfully logged in user ${data.username}. IP=${clientIP}`);

                        callback({
                            ok: true,
                            token: User.createJWT(user, server.jwtSecret),
                        });
                    } else {

                        log.warn("auth", `Invalid token provided for user ${data.username}. IP=${clientIP}`);

                        callback({
                            ok: false,
                            msg: "authInvalidToken",
                            msgi18n: true,
                        });
                    }
                }
            } else {

                log.warn("auth", `Incorrect username or password for user ${data.username}. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: "authIncorrectCreds",
                    msgi18n: true,
                });
            }

        });

        // Change Password
        socket.on("changePassword", async (password, callback) => {
            try {
                checkLogin(socket);

                if (! password.newPassword) {
                    throw new Error("Invalid new password");
                }

                if (passwordStrength(password.newPassword).value === "Too weak") {
                    throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                }

                let user = await doubleCheckPassword(socket, password.currentPassword);
                await user.resetPassword(password.newPassword);

                server.disconnectAllSocketClients(user.id, socket.id);

                callback({
                    ok: true,
                    msg: "Password has been updated successfully.",
                });

            } catch (e) {
                if (e instanceof Error) {
                    callback({
                        ok: false,
                        msg: e.message,
                    });
                }
            }
        });

        socket.on("getSettings", async (callback) => {
            try {
                checkLogin(socket);
                const data = await Settings.getSettings("general");

                callback({
                    ok: true,
                    data: data,
                });

            } catch (e) {
                if (e instanceof Error) {
                    callback({
                        ok: false,
                        msg: e.message,
                    });
                }
            }
        });

        socket.on("setSettings", async (data, currentPassword, callback) => {
            try {
                checkLogin(socket);

                // If currently is disabled auth, don't need to check
                // Disabled Auth + Want to Disable Auth => No Check
                // Disabled Auth + Want to Enable Auth => No Check
                // Enabled Auth + Want to Disable Auth => Check!!
                // Enabled Auth + Want to Enable Auth => No Check
                const currentDisabledAuth = await Settings.get("disableAuth");
                if (!currentDisabledAuth && data.disableAuth) {
                    await doubleCheckPassword(socket, currentPassword);
                }

                await Settings.setSettings("general", data);

                callback({
                    ok: true,
                    msg: "Saved"
                });

                server.sendInfo(socket);

            } catch (e) {
                if (e instanceof Error) {
                    callback({
                        ok: false,
                        msg: e.message,
                    });
                }
            }
        });

        // Disconnect all other socket clients of the user
        socket.on("disconnectOtherSocketClients", async () => {
            try {
                checkLogin(socket);
                server.disconnectAllSocketClients(socket.userID, socket.id);
            } catch (e) {
                if (e instanceof Error) {
                    log.warn("disconnectOtherSocketClients", e.message);
                }
            }
        });

        // composerize
        socket.on("composerize", async (dockerRunCommand : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(dockerRunCommand) !== "string") {
                    throw new ValidationError("dockerRunCommand must be a string");
                }

                // Option: 'latest' | 'v2x' | 'v3x'
                let composeTemplate = composerize(dockerRunCommand, "", "latest");

                // Remove the first line "name: <your project name>"
                composeTemplate = composeTemplate.split("\n").slice(1).join("\n");

                callback({
                    ok: true,
                    composeTemplate,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }

    async login(username : string, password : string) : Promise<User | null> {
        if (typeof username !== "string" || typeof password !== "string") {
            return null;
        }

        const user = await R.findOne("user", " username = ? AND active = 1 ", [
            username,
        ]) as User;

        if (user && verifyPassword(password, user.password)) {
            // Upgrade the hash to bcrypt
            if (needRehashPassword(user.password)) {
                await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
                    generatePasswordHash(password),
                    user.id,
                ]);
            }
            return user;
        }

        return null;
    }
}
