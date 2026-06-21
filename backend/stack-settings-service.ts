import { R } from "redbean-node";

export class StackSettingsService {
    static async getAutoUpdate(stackName: string, endpoint = ""): Promise<boolean> {
        const row = await R.getRow(
            "SELECT auto_update FROM stack_setting WHERE stack_name = ? AND endpoint = ?",
            [ stackName, endpoint ]
        );
        return !!row?.auto_update;
    }

    static async setAutoUpdate(stackName: string, enabled: boolean, endpoint = ""): Promise<void> {
        const existing = await R.getRow(
            "SELECT rowid FROM stack_setting WHERE stack_name = ? AND endpoint = ?",
            [ stackName, endpoint ]
        );

        if (existing) {
            await R.exec(
                "UPDATE stack_setting SET auto_update = ? WHERE stack_name = ? AND endpoint = ?",
                [ enabled ? 1 : 0, stackName, endpoint ]
            );
        } else {
            await R.exec(
                "INSERT INTO stack_setting (stack_name, endpoint, auto_update) VALUES (?, ?, ?)",
                [ stackName, endpoint, enabled ? 1 : 0 ]
            );
        }
    }

    static async getAutoUpdateStacks(): Promise<Array<{ stackName: string; endpoint: string }>> {
        const rows = await R.getAll(
            "SELECT stack_name, endpoint FROM stack_setting WHERE auto_update = 1"
        );
        return rows.map((row) => ({
            stackName: row.stack_name as string,
            endpoint: row.endpoint as string,
        }));
    }
}
