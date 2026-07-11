// @ts-ignore
import composerize from "composerize";
import { SocketHandler } from "../socket-handler.js";
import { BockgeServer } from "../bockge-server";
import { log } from "../log";
import { R } from "redbean-node";
import { randomBytes } from "crypto";
import { loginRateLimiter } from "../rate-limiter";
import { generatePasswordHash, needRehashPassword, shake256, SHAKE256_LENGTH, verifyPassword } from "../password-hash";
import { User } from "../models/user";
import {
    callbackError,
    checkLogin,
    BockgeSocket,
    doubleCheckPassword,
    JWTDecoded,
    ValidationError
} from "../util-server";
import { passwordStrength } from "check-password-strength";
import jwt from "jsonwebtoken";
import { Settings } from "../settings";
import { exec, spawn } from "child_process";
import fs, { promises as fsAsync } from "fs";
import path from "path";
import os from "os";

export class MainSocketHandler extends SocketHandler {
    create(socket : BockgeSocket, server : BockgeServer) {

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
                    throw new Error("Bockge has been initialized. If you want to run setup again, please delete the database.");
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
                server.afterLogin(socket, user);

                log.info("auth", `Successfully logged in user ${data.username}. IP=${clientIP}`);

                callback({
                    ok: true,
                    token: User.createJWT(user, server.jwtSecret),
                });
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

                data.disableAuth = false;
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

        // Change Username
        socket.on("changeUsername", async (data, callback) => {
            try {
                checkLogin(socket);
                if (!data.newUsername || typeof data.newUsername !== "string") {
                    throw new Error("Invalid new username");
                }
                const user = await doubleCheckPassword(socket, data.currentPassword);

                // Update username in DB
                await R.exec("UPDATE `user` SET username = ? WHERE id = ?", [
                    data.newUsername,
                    user.id,
                ]);

                log.info("auth", `User ${user.username} changed username to ${data.newUsername}`);

                callback({
                    ok: true,
                    msg: "Username changed successfully.",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Scan Image using Trivy or Grype
        socket.on("scanImage", async (imageName: unknown, scanner: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof imageName !== "string" || !imageName) {
                    throw new Error("Invalid image name");
                }
                if (typeof scanner !== "string") {
                    throw new Error("Invalid scanner selection");
                }
                
                let vulnerabilities: any[] = [];
                let errorMsg = "";

                const emitProgress = (step: string, message: string) => {
                    log.info("scanImage", `Emitting scanProgress: ${imageName} - ${step} - ${message}`);
                    socket.emit("scanProgress", { image: imageName, step, message });
                };

                const parseCleanJson = (stdout: string) => {
                    const firstBrace = stdout.indexOf("{");
                    const firstBracket = stdout.indexOf("[");
                    let clean = stdout;
                    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
                        clean = stdout.substring(firstBrace);
                    } else if (firstBracket !== -1) {
                        clean = stdout.substring(firstBracket);
                    }
                    return JSON.parse(clean);
                };

                if (scanner === "trivy" || scanner === "both") {
                    try {
                        emitProgress("trivy_pull", "Pulling Trivy scanner image...");
                        await new Promise((resolve) => exec("docker pull aquasec/trivy:latest", () => resolve(true)));
                        
                        emitProgress("trivy_scan", "Scanning image vulnerabilities with Trivy...");
                        const stdout = await runScanCommand(`docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v /tmp/bockge-cache/trivy:/root/.cache aquasec/trivy:latest image -q ${imageName} --format json`);
                        const data = parseCleanJson(stdout);
                        if (data && Array.isArray(data.Results)) {
                            for (const result of data.Results) {
                                if (result && Array.isArray(result.Vulnerabilities)) {
                                    for (const vuln of result.Vulnerabilities) {
                                        vulnerabilities.push({
                                            scanner: "Trivy",
                                            id: vuln.VulnerabilityID,
                                            pkgName: vuln.PkgName,
                                            installedVersion: vuln.InstalledVersion,
                                            fixedVersion: vuln.FixedVersion,
                                            severity: vuln.Severity,
                                            url: vuln.PrimaryURL || `https://nvd.nist.gov/vuln/detail/${vuln.VulnerabilityID}`
                                        });
                                    }
                                }
                            }
                        }
                    } catch (e: any) {
                        errorMsg += `Trivy scan failed: ${e.message}. `;
                    }
                }

                if (scanner === "grype" || scanner === "both") {
                    try {
                        emitProgress("grype_pull", "Pulling Grype scanner image...");
                        await new Promise((resolve) => exec("docker pull anchore/grype:latest", () => resolve(true)));
                        
                        emitProgress("grype_scan", "Scanning image vulnerabilities with Grype...");
                        const stdout = await runScanCommand(`docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v /tmp/bockge-cache/grype:/root/.cache anchore/grype:latest -q ${imageName} --output json`);
                        const data = parseCleanJson(stdout);
                        if (data && Array.isArray(data.matches)) {
                            for (const match of data.matches) {
                                if (match && match.vulnerability && match.artifact) {
                                    const vuln = match.vulnerability;
                                    const art = match.artifact;
                                    vulnerabilities.push({
                                        scanner: "Grype",
                                        id: vuln.id,
                                        pkgName: art.name,
                                        installedVersion: art.version,
                                        fixedVersion: vuln.fix?.versions?.join(", ") || "N/A",
                                        severity: vuln.severity.toUpperCase(),
                                        url: vuln.links?.[0] || `https://nvd.nist.gov/vuln/detail/${vuln.id}`
                                    });
                                }
                            }
                        }
                    } catch (e: any) {
                        errorMsg += `Grype scan failed: ${e.message}. `;
                    }
                }

                emitProgress("done", "Scan complete!");

                callback({
                    ok: vulnerabilities.length > 0 || !errorMsg,
                    vulnerabilities,
                    error: errorMsg
                });
            } catch (e: any) {
                callbackError(e, callback);
            }
        });

        // Get all Docker images
        socket.on("dockerGetImages", async (callback) => {
            try {
                checkLogin(socket);
                exec("docker image ls --format '{{json .}}'", { maxBuffer: 15 * 1024 * 1024 }, (err, stdout) => {
                    if (err) {
                        return callback({ ok: false, error: err.message });
                    }
                    try {
                        const lines = stdout.trim().split("\n").filter(l => l.trim() !== "");
                        const images = lines.map(l => JSON.parse(l));
                        callback({ ok: true, images });
                    } catch (pe) {
                        callback({ ok: false, error: "Failed to parse images list" });
                    }
                });
            } catch (e: any) {
                callback({ ok: false, error: e.message });
            }
        });

        // Pull an image from Docker registry
        socket.on("dockerPullImage", async (data: any, callback) => {
            try {
                checkLogin(socket);
                if (!data || typeof data.image !== "string" || !data.image) {
                    throw new Error("Invalid image name");
                }
                const imageName = data.image;
                
                const child = spawn("docker", ["pull", imageName]);
                
                child.stdout.on("data", (chunk) => {
                    socket.emit("dockerPullProgress", { image: imageName, output: chunk.toString() });
                });
                
                child.stderr.on("data", (chunk) => {
                    socket.emit("dockerPullProgress", { image: imageName, output: chunk.toString() });
                });
                
                child.on("close", (code) => {
                    if (code === 0) {
                        callback({ ok: true });
                    } else {
                        callback({ ok: false, error: `Pull exited with code ${code}` });
                    }
                });
            } catch (e: any) {
                callback({ ok: false, error: e.message });
            }
        });

        // Build an image from Dockerfile content
        socket.on("dockerBuildImage", async (data: any, callback) => {
            try {
                checkLogin(socket);
                if (!data || typeof data.tag !== "string" || typeof data.dockerfile !== "string") {
                    throw new Error("Invalid tag or Dockerfile content");
                }
                const tag = data.tag;
                const dockerfile = data.dockerfile;
                
                const tmpDir = path.join(os.tmpdir(), `bockge-build-${Date.now()}`);
                fs.mkdirSync(tmpDir, { recursive: true });
                fs.writeFileSync(path.join(tmpDir, "Dockerfile"), dockerfile);
                
                const child = spawn("docker", ["build", "-t", tag, "-f", path.join(tmpDir, "Dockerfile"), tmpDir]);
                
                child.stdout.on("data", (chunk) => {
                    socket.emit("dockerBuildProgress", { tag, output: chunk.toString() });
                });
                
                child.stderr.on("data", (chunk) => {
                    socket.emit("dockerBuildProgress", { tag, output: chunk.toString() });
                });
                
                child.on("close", (code) => {
                    try {
                        fs.rmSync(tmpDir, { recursive: true, force: true });
                    } catch (e) {
                        // ignore
                    }
                    if (code === 0) {
                        callback({ ok: true });
                    } else {
                        callback({ ok: false, error: `Build exited with code ${code}` });
                    }
                });
            } catch (e: any) {
                callback({ ok: false, error: e.message });
            }
        });

        // Delete individual image
        socket.on("dockerDeleteImage", async (id: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof id !== "string" || !id) {
                    throw new Error("Invalid image ID");
                }
                exec(`docker rmi ${id}`, (err, stdout, stderr) => {
                    if (err) {
                        return callback({ ok: false, error: stderr || err.message });
                    }
                    callback({ ok: true });
                });
            } catch (e: any) {
                callback({ ok: false, error: e.message });
            }
        });

        // Prune unused images
        socket.on("dockerPruneImages", async (callback) => {
            try {
                checkLogin(socket);
                exec("docker image prune -a -f", (err, stdout, stderr) => {
                    if (err) {
                        return callback({ ok: false, error: stderr || err.message });
                    }
                    callback({ ok: true, output: stdout });
                });
            } catch (e: any) {
                callback({ ok: false, error: e.message });
            }
        });

        // Get Docker disk usage statistics
        socket.on("dockerGetDiskUsage", async (callback) => {
            try {
                checkLogin(socket);
                exec("docker system df --format '{{json .}}'", { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
                    if (err) {
                        return callback({ ok: false, error: err.message });
                    }
                    try {
                        const lines = stdout.trim().split("\n").filter(l => l.trim() !== "");
                        const usage = lines.map(l => JSON.parse(l));
                        callback({ ok: true, usage });
                    } catch (pe) {
                        callback({ ok: false, error: "Failed to parse disk usage" });
                    }
                });
            } catch (e: any) {
                callback({ ok: false, error: e.message });
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

function runScanCommand(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: 300000, maxBuffer: 15 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                if (stdout && (stdout.trim().startsWith("{") || stdout.trim().startsWith("["))) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || error.message));
                }
            } else {
                resolve(stdout);
            }
        });
    });
}
