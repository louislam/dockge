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
import fs, { promises as fsAsync } from "fs";
import path from "path";
import { requireAdmin } from "../access-control";

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
                user.role = "admin";
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

        socket.on("listUsers", async (callback) => {
            try {
                await requireAdmin(socket);
                const users = await R.getAll(
                    "SELECT id, username, active, role, cpu_limit, memory_limit FROM user ORDER BY username"
                );
                callback({ ok: true,
                    users });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("createUser", async (data, callback) => {
            try {
                await requireAdmin(socket);
                if (await Settings.get("disableAuth")) {
                    throw new ValidationError("Enable authentication before creating additional user accounts");
                }
                if (!data || typeof data !== "object") {
                    throw new ValidationError("Invalid user data");
                }
                const userData = data as Record<string, unknown>;
                if (typeof userData.username !== "string" || !/^[a-zA-Z0-9_.-]{1,64}$/.test(userData.username)) {
                    throw new ValidationError("Username must be 1-64 letters, numbers, dots, underscores, or hyphens");
                }
                if (typeof userData.password !== "string" || passwordStrength(userData.password).value === "Too weak") {
                    throw new ValidationError("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                }
                const role = userData.role === "admin" ? "admin" : userData.role === "user" ? "user" : undefined;
                if (!role) {
                    throw new ValidationError("Invalid user role");
                }
                const cpuLimit = this.validateQuota(userData.cpuLimit, "CPU", 1024, true);
                const memoryLimit = this.validateQuota(userData.memoryLimit, "memory", 1024 * 1024, false);
                if (role === "admin" && (cpuLimit > 0 || memoryLimit > 0)) {
                    throw new ValidationError("Administrator accounts cannot have resource quotas");
                }
                const user = R.dispense("user");
                user.username = userData.username;
                user.password = generatePasswordHash(userData.password);
                user.role = role;
                user.cpu_limit = cpuLimit;
                user.memory_limit = memoryLimit * 1024 ** 2;
                user.active = true;
                await R.store(user);
                callback({ ok: true,
                    msg: "User created successfully." });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("updateUser", async (data, callback) => {
            try {
                await requireAdmin(socket);
                if (!data || typeof data !== "object") {
                    throw new ValidationError("Invalid user data");
                }
                const userData = data as Record<string, unknown>;
                const userID = Number(userData.id);
                if (!Number.isSafeInteger(userID) || userID < 1) {
                    throw new ValidationError("Invalid user ID");
                }
                const user = await R.findOne("user", "id = ?", [ userID ]) as User | null;
                if (!user) {
                    throw new ValidationError("User not found");
                }
                if (typeof userData.active !== "boolean") {
                    throw new ValidationError("Invalid account status");
                }
                const role = userData.role === "admin" ? "admin" : userData.role === "user" ? "user" : undefined;
                if (!role) {
                    throw new ValidationError("Invalid user role");
                }
                const cpuLimit = this.validateQuota(userData.cpuLimit, "CPU", 1024, true);
                const memoryLimit = this.validateQuota(userData.memoryLimit, "memory", 1024 * 1024, false);
                if (role === "admin" && (cpuLimit > 0 || memoryLimit > 0)) {
                    throw new ValidationError("Administrator accounts cannot have resource quotas");
                }
                if (userID === socket.userID && (!userData.active || role !== "admin")) {
                    throw new ValidationError("You cannot disable or demote your own account");
                }
                if (userID === socket.userID && userData.password !== undefined && userData.password !== "") {
                    throw new ValidationError("Use the Change Password page to update your own password");
                }
                if (user.role === "admin" && (role !== "admin" || !userData.active)) {
                    const otherAdmins = Number(await R.getCell(
                        "SELECT COUNT(*) FROM user WHERE role = 'admin' AND active = 1 AND id != ?",
                        [ userID ]
                    ));
                    if (otherAdmins === 0) {
                        throw new ValidationError("Dockge must have at least one active administrator");
                    }
                }
                const allocatedCPU = Number(await R.getCell(
                    "SELECT COALESCE(SUM(cpu), 0) FROM stack_owner WHERE user_id = ? AND endpoint = ''",
                    [ userID ]
                ));
                const allocatedMemory = Number(await R.getCell(
                    "SELECT COALESCE(SUM(memory), 0) FROM stack_owner WHERE user_id = ? AND endpoint = ''",
                    [ userID ]
                ));
                if (cpuLimit > 0 && allocatedCPU > cpuLimit) {
                    throw new ValidationError(`CPU quota cannot be set below current stack allocations (${allocatedCPU} cores)`);
                }
                if (cpuLimit > 0 && Number(await R.getCell(
                    "SELECT COUNT(*) FROM stack_owner WHERE user_id = ? AND endpoint = '' AND cpu_complete = 0",
                    [ userID ]
                )) > 0) {
                    throw new ValidationError("Add fixed deploy.resources.limits.cpus values to every owned stack before enabling a CPU quota");
                }
                const memoryLimitBytes = memoryLimit * 1024 ** 2;
                if (memoryLimitBytes > 0 && allocatedMemory > memoryLimitBytes) {
                    throw new ValidationError(`Memory quota cannot be set below current stack allocations (${Math.ceil(allocatedMemory / (1024 ** 2))} MiB)`);
                }
                if (memoryLimitBytes > 0 && Number(await R.getCell(
                    "SELECT COUNT(*) FROM stack_owner WHERE user_id = ? AND endpoint = '' AND memory_complete = 0",
                    [ userID ]
                )) > 0) {
                    throw new ValidationError("Add fixed deploy.resources.limits.memory values to every owned stack before enabling a memory quota");
                }

                user.role = role;
                user.active = userData.active;
                user.cpu_limit = cpuLimit;
                user.memory_limit = memoryLimitBytes;
                if (typeof userData.password === "string" && userData.password.length > 0) {
                    if (passwordStrength(userData.password).value === "Too weak") {
                        throw new ValidationError("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                    }
                    user.password = generatePasswordHash(userData.password);
                } else if (userData.password !== undefined && userData.password !== "") {
                    throw new ValidationError("Invalid password");
                }
                await R.store(user);
                if (userID !== socket.userID) {
                    server.disconnectAllSocketClients(userID);
                }
                callback({ ok: true,
                    msg: "User updated successfully." });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("deleteUser", async (userIDValue, callback) => {
            try {
                await requireAdmin(socket);
                const userID = Number(userIDValue);
                if (!Number.isSafeInteger(userID) || userID < 1 || userID === socket.userID) {
                    throw new ValidationError("Invalid user ID");
                }
                const user = await R.findOne("user", "id = ?", [ userID ]) as User | null;
                if (!user) {
                    throw new ValidationError("User not found");
                }
                if (user.role === "admin" && user.active) {
                    const otherAdmins = Number(await R.getCell(
                        "SELECT COUNT(*) FROM user WHERE role = 'admin' AND active = 1 AND id != ?",
                        [ userID ]
                    ));
                    if (otherAdmins === 0) {
                        throw new ValidationError("Dockge must have at least one active administrator");
                    }
                }
                await R.trash(user);
                server.disconnectAllSocketClients(userID);
                callback({ ok: true,
                    msg: "User deleted successfully." });
            } catch (e) {
                callbackError(e, callback);
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
                await requireAdmin(socket);
                const data = await Settings.getSettings("general");

                if (fs.existsSync(path.join(server.stacksDir, "global.env"))) {
                    data.globalENV = fs.readFileSync(path.join(server.stacksDir, "global.env"), "utf-8");
                } else {
                    data.globalENV = "# VARIABLE=value #comment";
                }

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
                await requireAdmin(socket);

                // If currently is disabled auth, don't need to check
                // Disabled Auth + Want to Disable Auth => No Check
                // Disabled Auth + Want to Enable Auth => No Check
                // Enabled Auth + Want to Disable Auth => Check!!
                // Enabled Auth + Want to Enable Auth => No Check
                const currentDisabledAuth = await Settings.get("disableAuth");
                if (!currentDisabledAuth && data.disableAuth) {
                    await doubleCheckPassword(socket, currentPassword);
                }
                if (data.disableAuth && Number(await R.getCell("SELECT COUNT(*) FROM user")) > 1) {
                    throw new ValidationError("Authentication cannot be disabled while additional user accounts exist");
                }
                // Handle global.env
                if (data.globalENV && data.globalENV != "# VARIABLE=value #comment") {
                    await fsAsync.writeFile(path.join(server.stacksDir, "global.env"), data.globalENV);
                } else {
                    await fsAsync.rm(path.join(server.stacksDir, "global.env"), {
                        recursive: true,
                        force: true
                    });
                }
                delete data.globalENV;

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

    private validateQuota(value: unknown, name: string, maximum: number, allowFraction: boolean): number {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
            throw new ValidationError(`${name} quota must be between 0 and ${maximum}`);
        }
        if (!allowFraction && !Number.isInteger(value)) {
            throw new ValidationError(`${name} quota must be a whole number`);
        }
        return value;
    }
}
