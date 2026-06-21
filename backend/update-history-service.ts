import { R } from "redbean-node";

export interface UpdateHistoryOptions {
    limit?: number;
    offset?: number;
    stackName?: string;
}

export class UpdateHistoryService {
    static async record(
        stackName: string,
        endpoint: string,
        triggerType: string,
        success: boolean,
        output: string | null,
        errorMessage: string | null,
        startedAt: string,
        completedAt: string,
        durationMs: number
    ): Promise<void> {
        await R.exec(
            `INSERT INTO update_history
                (stack_name, endpoint, trigger_type, success, output, error_message, started_at, completed_at, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                stackName,
                endpoint,
                triggerType,
                success ? 1 : 0,
                output,
                errorMessage,
                startedAt,
                completedAt,
                durationMs,
            ]
        );
    }

    static async getHistory(options: UpdateHistoryOptions = {}) {
        const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
        const offset = Math.max(options.offset ?? 0, 0);
        const conditions: string[] = [];
        const params: Array<string | number | boolean | null> = [];

        if (options.stackName) {
            conditions.push("stack_name = ?");
            params.push(options.stackName);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const count = await R.getRow(
            `SELECT COUNT(*) AS count FROM update_history ${where}`,
            params
        );
        const rows = await R.getAll(
            `SELECT * FROM update_history ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
            [ ...params, limit, offset ]
        );

        return {
            total: count?.count ?? 0,
            entries: rows.map((row: Record<string, unknown>) => ({
                id: row.id,
                stackName: row.stack_name,
                endpoint: row.endpoint,
                triggerType: row.trigger_type,
                success: !!row.success,
                output: row.output,
                errorMessage: row.error_message,
                startedAt: row.started_at,
                completedAt: row.completed_at,
                durationMs: row.duration_ms,
            })),
        };
    }

    static async cleanup(retentionDays = 90): Promise<void> {
        const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
        await R.exec("DELETE FROM update_history WHERE started_at < ?", [ cutoff ]);
    }
}
