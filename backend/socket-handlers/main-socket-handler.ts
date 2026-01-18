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
    checkAdmin,
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
                user.is_admin = true; // First user is always admin
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

                // If currently is disabled auth, don't need to check
                // Disabled Auth + Want to Disable Auth => No Check
                // Disabled Auth + Want to Enable Auth => No Check
                // Enabled Auth + Want to Disable Auth => Check!!
                // Enabled Auth + Want to Enable Auth => No Check
                const currentDisabledAuth = await Settings.get("disableAuth");
                if (!currentDisabledAuth && data.disableAuth) {
                    await doubleCheckPassword(socket, currentPassword);
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

        // ***************************
        // User Management (Admin Only)
        // ***************************

        // Get all users
        socket.on("getUserList", async (callback) => {
            try {
                await checkAdmin(socket);
                
                const users = await R.findAll("user", " ORDER BY username ASC ");
                const userList = [];
                
                for (const user of users) {
                    const groups = await R.getAll(`
                        SELECT g.id, g.name FROM \`group\` g
                        INNER JOIN user_group ug ON g.id = ug.group_id
                        WHERE ug.user_id = ?
                        ORDER BY g.name ASC
                    `, [user.id]);
                    
                    userList.push({
                        id: user.id,
                        username: user.username,
                        active: user.active,
                        is_admin: user.is_admin || false,
                        groups: groups,
                    });
                }
                
                callback({
                    ok: true,
                    users: userList,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Create a new user
        socket.on("createUser", async (userData, callback) => {
            try {
                await checkAdmin(socket);
                
                if (!userData.username || !userData.password) {
                    throw new ValidationError("Username and password are required");
                }
                
                if (passwordStrength(userData.password).value === "Too weak") {
                    throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                }
                
                // Check if username already exists
                const existingUser = await R.findOne("user", " username = ? ", [userData.username]);
                if (existingUser) {
                    throw new ValidationError("Username already exists");
                }
                
                const user = R.dispense("user");
                user.username = userData.username;
                user.password = generatePasswordHash(userData.password);
                user.active = true;
                user.is_admin = userData.is_admin || false;
                await R.store(user);
                
                callback({
                    ok: true,
                    msg: "User created successfully",
                    userId: user.id,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Update a user
        socket.on("updateUser", async (userId, userData, callback) => {
            try {
                await checkAdmin(socket);
                
                const user = await R.load("user", userId);
                if (!user || !user.id) {
                    throw new ValidationError("User not found");
                }
                
                // Prevent removing admin status from the last admin
                if (user.is_admin && !userData.is_admin) {
                    const adminCount = await R.count("user", " is_admin = 1 AND active = 1 ");
                    if (adminCount <= 1) {
                        throw new ValidationError("Cannot remove admin status from the last admin user");
                    }
                }
                
                // Prevent user from removing their own admin status
                if (user.id === socket.userID && user.is_admin && !userData.is_admin) {
                    throw new ValidationError("Cannot remove your own admin status");
                }
                
                user.active = userData.active !== undefined ? userData.active : user.active;
                user.is_admin = userData.is_admin !== undefined ? userData.is_admin : user.is_admin;
                
                if (userData.password) {
                    if (passwordStrength(userData.password).value === "Too weak") {
                        throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                    }
                    user.password = generatePasswordHash(userData.password);
                }
                
                await R.store(user);
                
                callback({
                    ok: true,
                    msg: "User updated successfully",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Delete a user
        socket.on("deleteUser", async (userId, callback) => {
            try {
                await checkAdmin(socket);
                
                // Prevent deleting yourself
                if (userId === socket.userID) {
                    throw new ValidationError("Cannot delete your own account");
                }
                
                const user = await R.load("user", userId);
                if (!user || !user.id) {
                    throw new ValidationError("User not found");
                }
                
                // Prevent deleting the last admin
                if (user.is_admin) {
                    const adminCount = await R.count("user", " is_admin = 1 AND active = 1 ");
                    if (adminCount <= 1) {
                        throw new ValidationError("Cannot delete the last admin user");
                    }
                }
                
                await R.trash(user);
                
                callback({
                    ok: true,
                    msg: "User deleted successfully",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // ***************************
        // Group Management (Admin Only)
        // ***************************

        // Get all groups
        socket.on("getGroupList", async (callback) => {
            try {
                await checkAdmin(socket);
                
                const groups = await R.findAll("group", " ORDER BY name ASC ");
                const groupList = [];
                
                for (const group of groups) {
                    const users = await R.getAll(`
                        SELECT u.id, u.username FROM user u
                        INNER JOIN user_group ug ON u.id = ug.user_id
                        WHERE ug.group_id = ?
                        ORDER BY u.username ASC
                    `, [group.id]);
                    
                    const stacks = await R.getAll(`
                        SELECT stack_name FROM stack_group
                        WHERE group_id = ?
                        ORDER BY stack_name ASC
                    `, [group.id]);
                    
                    groupList.push({
                        id: group.id,
                        name: group.name,
                        description: group.description,
                        users: users,
                        stacks: stacks.map((s: any) => s.stack_name),
                    });
                }
                
                callback({
                    ok: true,
                    groups: groupList,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Create a new group
        socket.on("createGroup", async (groupData, callback) => {
            try {
                await checkAdmin(socket);
                
                if (!groupData.name) {
                    throw new ValidationError("Group name is required");
                }
                
                // Check if group name already exists
                const existingGroup = await R.findOne("group", " name = ? ", [groupData.name]);
                if (existingGroup) {
                    throw new ValidationError("Group name already exists");
                }
                
                const group = R.dispense("group");
                group.name = groupData.name;
                group.description = groupData.description || "";
                await R.store(group);
                
                callback({
                    ok: true,
                    msg: "Group created successfully",
                    groupId: group.id,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Update a group
        socket.on("updateGroup", async (groupId, groupData, callback) => {
            try {
                await checkAdmin(socket);
                
                const group = await R.load("group", groupId);
                if (!group || !group.id) {
                    throw new ValidationError("Group not found");
                }
                
                if (groupData.name) {
                    // Check if new name already exists (excluding current group)
                    const existingGroup = await R.findOne("group", " name = ? AND id != ? ", [groupData.name, groupId]);
                    if (existingGroup) {
                        throw new ValidationError("Group name already exists");
                    }
                    group.name = groupData.name;
                }
                
                if (groupData.description !== undefined) {
                    group.description = groupData.description;
                }
                
                await R.store(group);
                
                callback({
                    ok: true,
                    msg: "Group updated successfully",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Delete a group
        socket.on("deleteGroup", async (groupId, callback) => {
            try {
                await checkAdmin(socket);
                
                const group = await R.load("group", groupId);
                if (!group || !group.id) {
                    throw new ValidationError("Group not found");
                }
                
                await R.trash(group);
                
                callback({
                    ok: true,
                    msg: "Group deleted successfully",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Add user to group
        socket.on("addUserToGroup", async (userId, groupId, callback) => {
            try {
                await checkAdmin(socket);
                
                const existing = await R.findOne("user_group", " user_id = ? AND group_id = ? ", [userId, groupId]);
                if (existing) {
                    throw new ValidationError("User is already in this group");
                }
                
                await R.exec("INSERT INTO user_group (user_id, group_id) VALUES (?, ?)", [userId, groupId]);
                
                callback({
                    ok: true,
                    msg: "User added to group successfully",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Remove user from group
        socket.on("removeUserFromGroup", async (userId, groupId, callback) => {
            try {
                await checkAdmin(socket);
                
                await R.exec("DELETE FROM user_group WHERE user_id = ? AND group_id = ?", [userId, groupId]);
                
                callback({
                    ok: true,
                    msg: "User removed from group successfully",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Assign stack to group
        socket.on("assignStackToGroup", async (stackName, groupId, callback) => {
            try {
                await checkAdmin(socket);
                
                const existing = await R.findOne("stack_group", " stack_name = ? AND group_id = ? ", [stackName, groupId]);
                if (existing) {
                    throw new ValidationError("Stack is already assigned to this group");
                }
                
                await R.exec("INSERT INTO stack_group (stack_name, group_id) VALUES (?, ?)", [stackName, groupId]);
                
                callback({
                    ok: true,
                    msg: "Stack assigned to group successfully",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Remove stack from group
        socket.on("removeStackFromGroup", async (stackName, groupId, callback) => {
            try {
                await checkAdmin(socket);
                
                await R.exec("DELETE FROM stack_group WHERE stack_name = ? AND group_id = ?", [stackName, groupId]);
                
                callback({
                    ok: true,
                    msg: "Stack removed from group successfully",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Get current user info (including admin status)
        socket.on("getUserInfo", async (callback) => {
            try {
                checkLogin(socket);
                
                const user = await R.findOne("user", " id = ? AND active = 1 ", [socket.userID]);
                
                if (!user) {
                    throw new Error("User not found");
                }
                
                callback({
                    ok: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        is_admin: user.is_admin || false,
                    },
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
