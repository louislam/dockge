import { NextFunction, Express, Request, Response, Router as ExpressRouter } from "express";
import express from "express";
import crypto from "node:crypto";
import childProcessAsync from "promisify-child-process";
import { Cron } from "croner";
import { DockgeServer } from "../dockge-server";
import { log } from "../log";
import { Router } from "../router";
import { Settings } from "../settings";
import { Stack } from "../stack";
import { ImageUpdateService } from "../image-update-service";
import { StackSettingsService } from "../stack-settings-service";
import { StackUpdateService } from "../stack-update-service";
import { UpdateHistoryService } from "../update-history-service";
import { Agent } from "../models/agent";
import { ValidationError } from "../util-server";
import {
    CREATED_FILE,
    CREATED_STACK,
    EXITED,
    RUNNING,
    UNKNOWN,
} from "../../common/util-common";

const VALID_STACK_NAME = /^[a-z0-9_-]+$/;

const STATUS_NAMES: Record<number, string> = {
    [UNKNOWN]: "unknown",
    [CREATED_FILE]: "created_file",
    [CREATED_STACK]: "created_stack",
    [RUNNING]: "running",
    [EXITED]: "exited",
};

async function resolveEndpoint(value: unknown): Promise<string> {
    if (typeof value !== "string" || !value) {
        return "";
    }
    if (value.includes(":")) {
        return value;
    }
    const agents = await Agent.getAgentList();
    for (const url in agents) {
        const agent = agents[url];
        if (agent.name?.toLowerCase() === value.toLowerCase()) {
            return agent.endpoint;
        }
    }
    return value;
}

async function emitToAgent(
    server: DockgeServer,
    endpoint: string,
    eventName: string,
    ...args: unknown[]
): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Agent ${endpoint} timed out`)), 300000);
        server.serverAgentManager.emitToEndpoint(
            endpoint,
            eventName,
            ...args,
            (result: Record<string, unknown>) => {
                clearTimeout(timeout);
                resolve(result);
            }
        ).catch((error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

type ComposeService = {
    Service?: string;
    Name?: string;
    Image?: string;
    State?: string;
    Status?: string;
    Health?: string;
};

async function getConfiguredApiKey(): Promise<string> {
    const storedKey = await Settings.get("apiKey");
    if (typeof storedKey === "string" && storedKey) {
        return storedKey;
    }
    return process.env.DOCKGE_API_KEY ?? "";
}

async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const apiKey = await getConfiguredApiKey();
        if (!apiKey) {
            res.status(503).json({
                ok: false,
                error: "API key not configured. Configure one in Settings > Integrations or set DOCKGE_API_KEY.",
            });
            return;
        }

        const provided = req.header("X-API-Key") ?? "";
        const expectedBuffer = Buffer.from(apiKey);
        const providedBuffer = Buffer.from(provided);

        if (
            expectedBuffer.length !== providedBuffer.length ||
            !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
        ) {
            res.status(401).json({
                ok: false,
                error: "Invalid or missing API key"
            });
            return;
        }

        next();
    } catch (e) {
        log.error("api", `Failed to validate API key: ${e}`);
        res.status(500).json({
            ok: false,
            error: "Failed to validate API key"
        });
    }
}

function validateStackName(req: Request, res: Response, next: NextFunction): void {
    if (!VALID_STACK_NAME.test(req.params.name ?? "")) {
        res.status(400).json({ ok: false,
            error: "Invalid stack name" });
        return;
    }
    next();
}

function normalizeComposeServices(data: object): ComposeService[] {
    if (Array.isArray(data)) {
        return data;
    }
    return Object.keys(data).length ? [ data as ComposeService ] : [];
}

async function getImageVersion(image: string, cache: Map<string, string | null>): Promise<string | null> {
    if (!image) {
        return null;
    }
    if (cache.has(image)) {
        return cache.get(image) ?? null;
    }

    try {
        const result = await childProcessAsync.spawn(
            "docker",
            [
                "image",
                "inspect",
                "--format",
                "{{json (index .Config.Labels \"org.opencontainers.image.version\")}}",
                image,
            ],
            { encoding: "utf-8" }
        );
        const output = result.stdout?.toString().trim() ?? "";
        const version = output && output !== "null" ? JSON.parse(output) : null;
        cache.set(image, typeof version === "string" ? version : null);
    } catch (e) {
        log.debug("api", `Could not read OCI version label for ${image}: ${e}`);
        cache.set(image, null);
    }

    return cache.get(image) ?? null;
}

async function getStackServices(stack: Stack, imageVersionCache: Map<string, string | null>) {
    const cached = ImageUpdateService.getCached(stack.name);
    if (cached) {
        return cached;
    }
    const services: Record<string, object> = {};
    const serviceList = normalizeComposeServices(await stack.ps());

    for (const service of serviceList) {
        const name = service.Service ?? service.Name;
        if (!name) {
            continue;
        }
        const image = service.Image ?? "";
        services[name] = {
            name,
            containerName: service.Name ?? name,
            image,
            imageVersion: await getImageVersion(image, imageVersionCache),
            state: service.State ?? "unknown",
            status: service.Status ?? "",
            health: service.Health ?? "",
            imageUpdateAvailable: false,
        };
    }

    return services;
}

async function runCompose(stack: Stack, command: string, ...options: string[]) {
    if (!stack.isManagedByDockge) {
        throw new ValidationError("Stack is not managed by Dockge");
    }
    const result = await childProcessAsync.spawn(
        "docker",
        stack.getComposeOptions(command, ...options),
        {
            cwd: stack.path,
            encoding: "utf-8",
        }
    );

    return result;
}

function sendStackError(res: Response, error: unknown, action: string): void {
    if (error instanceof ValidationError) {
        res.status(404).json({ ok: false,
            error: "Stack not found" });
        return;
    }
    const message = error instanceof Error ? error.message : String(error);
    log.error("api", `${action}: ${message}`);
    res.status(500).json({ ok: false,
        error: message });
}

export class ApiRouter extends Router {
    create(_app: Express, server: DockgeServer): ExpressRouter {
        const router = express.Router();

        router.get("/api/health", (_req: Request, res: Response) => {
            res.json({
                status: "ok",
                version: server.packageJSON.version,
            });
        });

        router.use("/api", apiKeyAuth);

        router.get("/api/events", (req: Request, res: Response) => {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders();
            server.sseManager.addClient(res);
        });

        router.get("/api/agents", async (_req: Request, res: Response) => {
            const configuredAgents = await Agent.getAgentList();
            const agents: Array<{
                endpoint: string;
                name: string;
                url: string;
                version: string | null | undefined;
                connected: boolean;
            }> = [
                {
                    endpoint: "",
                    name: await Settings.get("primaryHostname") || "Primary",
                    url: "",
                    version: server.packageJSON.version,
                    connected: true,
                },
            ];
            for (const url in configuredAgents) {
                const agent = configuredAgents[url];
                if (!agent.url) {
                    continue;
                }
                agents.push({
                    endpoint: agent.endpoint,
                    name: agent.name || agent.endpoint,
                    url: agent.url,
                    version: server.serverAgentManager.getVersion(agent.endpoint),
                    connected: server.serverAgentManager.isConnected(agent.endpoint),
                });
            }
            res.json({
                ok: true,
                agents,
            });
        });

        router.get("/api/stacks", async (_req: Request, res: Response) => {
            try {
                const imageVersionCache = new Map<string, string | null>();
                const stackList = await Stack.getStackList(server, true);
                const stacks = [];

                for (const [ name, stack ] of stackList) {
                    stacks.push({
                        name,
                        status: STATUS_NAMES[stack.status] ?? "unknown",
                        statusCode: stack.status,
                        isManagedByDockge: stack.isManagedByDockge,
                        endpoint: "",
                        autoUpdate: await StackSettingsService.getAutoUpdate(name),
                        imageUpdatesAvailable: ImageUpdateService.hasUpdates(name),
                        services: await getStackServices(stack, imageVersionCache),
                    });
                }

                const agents = await Agent.getAgentList();
                for (const url in agents) {
                    const agent = agents[url];
                    if (!agent.url) {
                        continue;
                    }
                    try {
                        const result = await emitToAgent(server, agent.endpoint, "getApiStackList");
                        const remoteStacks = result.stacks as Record<string, Record<string, unknown>> | undefined;
                        for (const name in remoteStacks ?? {}) {
                            const stack = remoteStacks![name];
                            stacks.push({
                                ...stack,
                                name,
                                status: STATUS_NAMES[stack.status as number] ?? "unknown",
                                statusCode: stack.status,
                                endpoint: agent.endpoint,
                                autoUpdate: await StackSettingsService.getAutoUpdate(name, agent.endpoint),
                            });
                        }
                    } catch (e) {
                        log.warn("api", `Failed to query agent ${agent.endpoint}: ${e}`);
                    }
                }

                res.json({ ok: true,
                    stacks });
            } catch (e) {
                log.error("api", `Failed to list stacks: ${e}`);
                res.status(500).json({ ok: false,
                    error: "Failed to list stacks" });
            }
        });

        router.get("/api/stacks/:name/status", validateStackName, async (req: Request, res: Response) => {
            try {
                const endpoint = await resolveEndpoint(req.query.endpoint);
                if (endpoint) {
                    const result = await emitToAgent(server, endpoint, "getStack", req.params.name);
                    res.json(result);
                    return;
                }
                const stack = await Stack.getStack(server, req.params.name);
                await stack.updateStatus();
                const imageVersionCache = new Map<string, string | null>();

                res.json({
                    ok: true,
                    stack: {
                        name: stack.name,
                        status: STATUS_NAMES[stack.status] ?? "unknown",
                        statusCode: stack.status,
                        isManagedByDockge: stack.isManagedByDockge,
                        endpoint: "",
                        imageUpdatesAvailable: ImageUpdateService.hasUpdates(stack.name),
                        services: await getStackServices(stack, imageVersionCache),
                    },
                });
            } catch (e) {
                sendStackError(res, e, `Failed to get stack ${req.params.name}`);
            }
        });

        router.post("/api/stacks/:name/start", validateStackName, async (req: Request, res: Response) => {
            try {
                const endpoint = await resolveEndpoint(req.query.endpoint);
                if (endpoint) {
                    const result = await emitToAgent(server, endpoint, "startStack", req.params.name);
                    res.status(result.ok ? 200 : 500).json(result);
                    return;
                }
                const stack = await Stack.getStack(server, req.params.name);
                await runCompose(stack, "up", "-d", "--remove-orphans");
                await server.sendStackList();
                server.sseManager.broadcast("stack_changed", {
                    stackName: stack.name,
                    action: "start",
                    endpoint: "",
                });
                res.json({ ok: true,
                    message: `Stack '${stack.name}' started`,
                    endpoint: "" });
            } catch (e) {
                sendStackError(res, e, `Failed to start stack ${req.params.name}`);
            }
        });

        router.post("/api/stacks/:name/stop", validateStackName, async (req: Request, res: Response) => {
            try {
                const endpoint = await resolveEndpoint(req.query.endpoint);
                if (endpoint) {
                    const result = await emitToAgent(server, endpoint, "stopStack", req.params.name);
                    res.status(result.ok ? 200 : 500).json(result);
                    return;
                }
                const stack = await Stack.getStack(server, req.params.name);
                await runCompose(stack, "stop");
                await server.sendStackList();
                server.sseManager.broadcast("stack_changed", {
                    stackName: stack.name,
                    action: "stop",
                    endpoint: "",
                });
                res.json({ ok: true,
                    message: `Stack '${stack.name}' stopped`,
                    endpoint: "" });
            } catch (e) {
                sendStackError(res, e, `Failed to stop stack ${req.params.name}`);
            }
        });

        router.post("/api/stacks/:name/restart", validateStackName, async (req: Request, res: Response) => {
            try {
                const endpoint = await resolveEndpoint(req.query.endpoint);
                if (endpoint) {
                    const result = await emitToAgent(server, endpoint, "restartStack", req.params.name);
                    res.status(result.ok ? 200 : 500).json(result);
                    return;
                }
                const stack = await Stack.getStack(server, req.params.name);
                await runCompose(stack, "restart");
                await server.sendStackList();
                server.sseManager.broadcast("stack_changed", {
                    stackName: stack.name,
                    action: "restart",
                    endpoint: "",
                });
                res.json({ ok: true,
                    message: `Stack '${stack.name}' restarted`,
                    endpoint: "" });
            } catch (e) {
                sendStackError(res, e, `Failed to restart stack ${req.params.name}`);
            }
        });

        router.post("/api/stacks/:name/update", validateStackName, async (req: Request, res: Response) => {
            try {
                const endpoint = await resolveEndpoint(req.query.endpoint);
                if (endpoint) {
                    const result = await emitToAgent(server, endpoint, "updateStack", req.params.name);
                    res.status(result.ok ? 200 : 500).json(result);
                    return;
                }
                await StackUpdateService.update(server, req.params.name, "api");
                await server.sendStackList();
                server.sseManager.broadcast("stack_changed", {
                    stackName: req.params.name,
                    action: "update",
                    endpoint: "",
                });
                res.json({ ok: true,
                    message: `Stack '${req.params.name}' updated`,
                    endpoint: "" });
            } catch (e) {
                sendStackError(res, e, `Failed to update stack ${req.params.name}`);
            }
        });

        router.post("/api/stacks/:name/check-updates", validateStackName, async (req: Request, res: Response) => {
            try {
                const endpoint = await resolveEndpoint(req.query.endpoint);
                if (endpoint) {
                    const result = await emitToAgent(server, endpoint, "checkApiStackUpdates", req.params.name);
                    res.status(result.ok ? 200 : 500).json(result);
                    return;
                }
                const stack = await Stack.getStack(server, req.params.name);
                const services = await ImageUpdateService.getServices(stack, true);
                server.sseManager.broadcast("updates_checked", {
                    stackName: stack.name,
                    endpoint: "",
                });
                res.json({
                    ok: true,
                    endpoint: "",
                    imageUpdatesAvailable: Object.values(services)
                        .some((service) => service.imageUpdateAvailable),
                    services,
                });
            } catch (e) {
                sendStackError(res, e, `Failed to check stack ${req.params.name}`);
            }
        });

        router.get("/api/stacks/:name/auto-update", validateStackName, async (req: Request, res: Response) => {
            try {
                const endpoint = await resolveEndpoint(req.query.endpoint);
                if (!endpoint) {
                    await Stack.getStack(server, req.params.name);
                }
                res.json({ ok: true,
                    autoUpdate: await StackSettingsService.getAutoUpdate(req.params.name, endpoint),
                    endpoint });
            } catch (e) {
                sendStackError(res, e, `Failed to get auto-update state for ${req.params.name}`);
            }
        });

        router.put("/api/stacks/:name/auto-update", validateStackName, async (req: Request, res: Response) => {
            try {
                const endpoint = await resolveEndpoint(req.query.endpoint);
                if (!endpoint) {
                    await Stack.getStack(server, req.params.name);
                }
                if (typeof req.body.enabled !== "boolean") {
                    res.status(400).json({
                        ok: false,
                        error: "enabled must be a boolean",
                    });
                    return;
                }
                await StackSettingsService.setAutoUpdate(req.params.name, req.body.enabled, endpoint);
                server.sseManager.broadcast("auto_update_changed", {
                    stackName: req.params.name,
                    endpoint,
                    enabled: req.body.enabled,
                });
                res.json({
                    ok: true,
                    autoUpdate: req.body.enabled,
                    endpoint,
                });
            } catch (e) {
                sendStackError(res, e, `Failed to set auto-update state for ${req.params.name}`);
            }
        });

        router.post("/api/update-all", async (_req: Request, res: Response) => {
            try {
                const stackList = await Stack.getStackList(server, true);
                const results = [];

                for (const [ name, stack ] of stackList) {
                    if (!stack.isManagedByDockge) {
                        continue;
                    }
                    try {
                        await StackUpdateService.update(server, name, "api");
                        results.push({
                            name,
                            success: true,
                        });
                    } catch (e) {
                        results.push({
                            name,
                            success: false,
                            error: e instanceof Error ? e.message : String(e),
                        });
                    }
                }

                await server.sendStackList();
                server.sseManager.broadcast("stacks_updated", {
                    trigger: "api",
                });
                res.json({
                    ok: results.every((result) => result.success),
                    results,
                });
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                log.error("api", `Failed to update all stacks: ${message}`);
                res.status(500).json({
                    ok: false,
                    error: message,
                });
            }
        });

        router.get("/api/scheduler", async (_req: Request, res: Response) => {
            res.json({
                enabled: await Settings.get("schedulerEnabled") ?? false,
                cronExpression: await Settings.get("schedulerCron") ?? "0 3 * * *",
                nextAutoUpdate: server.autoUpdateScheduler?.getNextRunTime() ?? null,
                nextImageCheck: null,
            });
        });

        router.get("/api/update-history", async (req: Request, res: Response) => {
            const limit = Number.parseInt(req.query.limit as string, 10);
            const offset = Number.parseInt(req.query.offset as string, 10);
            const history = await UpdateHistoryService.getHistory({
                limit: Number.isFinite(limit) ? limit : undefined,
                offset: Number.isFinite(offset) ? offset : undefined,
                stackName: typeof req.query.stack_name === "string" ? req.query.stack_name : undefined,
            });
            res.json({ ok: true,
                ...history });
        });

        router.put("/api/scheduler", async (req: Request, res: Response) => {
            if (req.body.enabled !== undefined && typeof req.body.enabled !== "boolean") {
                res.status(400).json({ ok: false,
                    error: "enabled must be a boolean" });
                return;
            }
            if (req.body.cronExpression !== undefined && typeof req.body.cronExpression !== "string") {
                res.status(400).json({ ok: false,
                    error: "cronExpression must be a string" });
                return;
            }
            if (req.body.enabled !== undefined) {
                await Settings.set("schedulerEnabled", req.body.enabled, "boolean");
            }
            if (req.body.cronExpression !== undefined) {
                try {
                    new Cron(req.body.cronExpression);
                } catch {
                    res.status(400).json({ ok: false,
                        error: "Invalid cron expression" });
                    return;
                }
                await Settings.set("schedulerCron", req.body.cronExpression, "string");
            }
            await server.autoUpdateScheduler?.restart();
            server.sseManager.broadcast("scheduler_changed", {});
            res.json({ ok: true });
        });

        router.post("/api/scheduler/trigger", async (_req: Request, res: Response) => {
            await server.autoUpdateScheduler?.run("api-trigger");
            server.sseManager.broadcast("stacks_updated", {
                trigger: "api-trigger",
            });
            res.json({ ok: true });
        });

        router.post("/api/system/prune", async (_req: Request, res: Response) => {
            try {
                const result = await childProcessAsync.spawn(
                    "docker",
                    [ "system", "prune", "-a", "-f" ],
                    { encoding: "utf-8" }
                );
                res.json({ ok: true,
                    output: result.stdout?.toString() ?? "",
                    endpoint: "" });
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                log.error("api", `Failed to prune Docker system: ${message}`);
                res.status(500).json({ ok: false,
                    error: message });
            }
        });

        return router;
    }
}
