import { Cron } from "croner";
import { DockgeServer } from "../dockge-server";
import { ImageUpdateService } from "../image-update-service";
import { Settings } from "../settings";
import { SocketHandler } from "../socket-handler";
import { StackSettingsService } from "../stack-settings-service";
import { Stack } from "../stack";
import { UpdateHistoryService } from "../update-history-service";
import { callbackError, checkLogin, DockgeSocket, ValidationError } from "../util-server";

export class UpdateManagementSocketHandler extends SocketHandler {
    create(socket: DockgeSocket, server: DockgeServer): void {
        socket.on("getAutoUpdate", async (stackName: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof stackName !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                callback({
                    ok: true,
                    enabled: await StackSettingsService.getAutoUpdate(stackName),
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("setAutoUpdate", async (stackName: unknown, enabled: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof stackName !== "string" || typeof enabled !== "boolean") {
                    throw new ValidationError("Invalid auto-update settings");
                }
                await Stack.getStack(server, stackName);
                await StackSettingsService.setAutoUpdate(stackName, enabled);
                callback({
                    ok: true,
                    msg: "Saved",
                    msgi18n: true,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("checkStackUpdates", async (stackName: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof stackName !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                const stack = await Stack.getStack(server, stackName);
                const services = await ImageUpdateService.getServices(stack, true);
                callback({
                    ok: true,
                    imageUpdatesAvailable: Object.values(services)
                        .some((service) => service.imageUpdateAvailable),
                    services,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("getSchedulerSettings", async (callback) => {
            try {
                checkLogin(socket);
                callback({
                    ok: true,
                    data: {
                        enabled: await Settings.get("schedulerEnabled") ?? false,
                        cronExpression: await Settings.get("schedulerCron") ?? "0 3 * * *",
                        nextAutoUpdate: server.autoUpdateScheduler?.getNextRunTime() ?? null,
                    },
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("setSchedulerSettings", async (data: unknown, callback) => {
            try {
                checkLogin(socket);
                if (!data || typeof data !== "object") {
                    throw new ValidationError("Invalid scheduler settings");
                }
                const settings = data as Record<string, unknown>;
                if (typeof settings.enabled !== "boolean" || typeof settings.cronExpression !== "string") {
                    throw new ValidationError("Invalid scheduler settings");
                }
                try {
                    new Cron(settings.cronExpression);
                } catch {
                    throw new ValidationError("Invalid cron expression");
                }
                await Settings.set("schedulerEnabled", settings.enabled, "boolean");
                await Settings.set("schedulerCron", settings.cronExpression, "string");
                await server.autoUpdateScheduler?.restart();
                callback({
                    ok: true,
                    msg: "Saved",
                    msgi18n: true,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("triggerAutoUpdates", async (callback) => {
            try {
                checkLogin(socket);
                await server.autoUpdateScheduler?.run("manual");
                callback({
                    ok: true,
                    msg: "Updated",
                    msgi18n: true,
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("getUpdateHistory", async (options: unknown, callback) => {
            try {
                checkLogin(socket);
                const data = options && typeof options === "object"
                    ? options as Record<string, unknown>
                    : {};
                callback({
                    ok: true,
                    data: await UpdateHistoryService.getHistory({
                        limit: typeof data.limit === "number" ? data.limit : undefined,
                        offset: typeof data.offset === "number" ? data.offset : undefined,
                        stackName: typeof data.stackName === "string" ? data.stackName : undefined,
                    }),
                });
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }
}
