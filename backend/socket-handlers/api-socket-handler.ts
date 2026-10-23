import crypto from "node:crypto";
import { DockgeServer } from "../dockge-server";
import { Settings } from "../settings";
import { SocketHandler } from "../socket-handler";
import { callbackError, checkLogin, DockgeSocket } from "../util-server";

const MIN_API_KEY_LENGTH = 32;

export class ApiSocketHandler extends SocketHandler {
    create(socket: DockgeSocket, _server: DockgeServer): void {
        socket.on("getApiKeyStatus", async (callback) => {
            try {
                checkLogin(socket);
                const storedKey = await Settings.get("apiKey");
                const hasStoredKey = typeof storedKey === "string" && storedKey.length > 0;

                callback({
                    ok: true,
                    configured: hasStoredKey || !!process.env.DOCKGE_API_KEY,
                    source: hasStoredKey ? "settings" : process.env.DOCKGE_API_KEY ? "environment" : null,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("setApiKey", async (apiKey: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof apiKey !== "string" || apiKey.trim().length < MIN_API_KEY_LENGTH) {
                    throw new Error(`API key must contain at least ${MIN_API_KEY_LENGTH} characters.`);
                }

                await Settings.set("apiKey", apiKey.trim(), "api");
                callback({ ok: true,
                    msg: "API key saved successfully." });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("generateApiKey", async (callback) => {
            try {
                checkLogin(socket);
                const apiKey = crypto.randomBytes(32).toString("hex");
                await Settings.set("apiKey", apiKey, "api");
                callback({
                    ok: true,
                    msg: "API key generated successfully.",
                    apiKey,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("revokeApiKey", async (callback) => {
            try {
                checkLogin(socket);
                await Settings.set("apiKey", "", "api");
                callback({
                    ok: true,
                    msg: process.env.DOCKGE_API_KEY
                        ? "Saved API key removed. DOCKGE_API_KEY is still active."
                        : "API key revoked successfully.",
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }
}
