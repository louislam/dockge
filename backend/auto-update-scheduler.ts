import { Cron } from "croner";
import { DockgeServer } from "./dockge-server";
import { log } from "./log";
import { Settings } from "./settings";
import { StackSettingsService } from "./stack-settings-service";
import { StackUpdateService } from "./stack-update-service";
import { UpdateHistoryService } from "./update-history-service";

export class AutoUpdateScheduler {
    private cron: Cron | null = null;
    private running = false;

    constructor(private server: DockgeServer) {
        server.restartScheduler = () => this.restart();
    }

    async start(): Promise<void> {
        if (!await Settings.get("schedulerEnabled")) {
            log.info("scheduler", "Auto-update scheduler is disabled");
            return;
        }

        const expression = await Settings.get("schedulerCron") ?? "0 3 * * *";
        this.cron = new Cron(expression, { protect: true }, async () => {
            await this.run("scheduled");
        });
        log.info("scheduler", `Auto-update scheduler started with cron ${expression}`);
    }

    stop(): void {
        this.cron?.stop();
        this.cron = null;
    }

    async restart(): Promise<void> {
        this.stop();
        await this.start();
    }

    getNextRunTime(): string | null {
        return this.cron?.nextRun()?.toISOString() ?? null;
    }

    async run(triggerType = "scheduled"): Promise<void> {
        if (this.running) {
            log.info("scheduler", "Skipping update run because another run is active");
            return;
        }

        this.running = true;
        try {
            for (const { stackName, endpoint } of await StackSettingsService.getAutoUpdateStacks()) {
                try {
                    if (endpoint) {
                        await new Promise<void>((resolve, reject) => {
                            this.server.serverAgentManager.emitToEndpoint(
                                endpoint,
                                "updateStack",
                                stackName,
                                (result: { ok?: boolean; msg?: string }) => {
                                    result.ok ? resolve() : reject(new Error(result.msg ?? "Update failed"));
                                }
                            ).catch(reject);
                        });
                    } else {
                        await StackUpdateService.update(this.server, stackName, triggerType);
                    }
                    log.info("scheduler", `Updated stack ${stackName}`);
                } catch (e) {
                    log.error("scheduler", `Failed to update ${stackName}: ${e}`);
                }
            }
            await UpdateHistoryService.cleanup();
            await this.server.sendStackList();
            this.server.sseManager.broadcast("stacks_updated", {
                trigger: triggerType,
            });
        } finally {
            this.running = false;
        }
    }
}
