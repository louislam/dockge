import childProcessAsync from "promisify-child-process";
import { DockgeServer } from "./dockge-server";
import { ImageUpdateService } from "./image-update-service";
import { Stack } from "./stack";
import { UpdateHistoryService } from "./update-history-service";
import { RUNNING } from "../common/util-common";

export class StackUpdateService {
    static async update(
        server: DockgeServer,
        stackName: string,
        triggerType: string
    ): Promise<void> {
        const startedAt = new Date().toISOString();
        const startTime = Date.now();
        let output = "";

        try {
            const stack = await Stack.getStack(server, stackName);
            if (!stack.isManagedByDockge) {
                throw new Error("Stack is not managed by Dockge");
            }

            const pull = await childProcessAsync.spawn(
                "docker",
                stack.getComposeOptions("pull"),
                {
                    cwd: stack.path,
                    encoding: "utf-8",
                }
            );
            output += `${pull.stdout ?? ""}${pull.stderr ?? ""}`;

            await stack.updateStatus();
            if (stack.status === RUNNING) {
                const up = await childProcessAsync.spawn(
                    "docker",
                    stack.getComposeOptions("up", "-d", "--remove-orphans"),
                    {
                        cwd: stack.path,
                        encoding: "utf-8",
                    }
                );
                output += `${up.stdout ?? ""}${up.stderr ?? ""}`;
            }

            await ImageUpdateService.getServices(stack, false);
            await UpdateHistoryService.record(
                stackName,
                "",
                triggerType,
                true,
                output || null,
                null,
                startedAt,
                new Date().toISOString(),
                Date.now() - startTime
            );
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await UpdateHistoryService.record(
                stackName,
                "",
                triggerType,
                false,
                output || null,
                message,
                startedAt,
                new Date().toISOString(),
                Date.now() - startTime
            );
            throw e;
        }
    }
}
