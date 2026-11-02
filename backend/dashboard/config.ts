import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { log } from "../log";

export const defaults = () => ({
    version: 1,
    groups: [{ id: "lan",
        name: "localServices",
        order: 0,
        enabled: true }],
    manualLinks: [],
    stackLinkOverrides: {},
    settings: { showStats: true,
        showUrls: true,
        showStackUrls: true,
        showOffline: true,
        defaultOpenInNewTab: true,
        cardSize: "medium",
        columns: "auto",
        statusCheckEnabled: false },
});

/** Validate untrusted dashboard configuration before it is persisted. */
export function validateConfig(value: unknown): asserts value is ReturnType<typeof defaults> {
    // Untrusted JSON is validated field by field below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = value as any;
    const text = (s: unknown, max = 500) => typeof s === "string" && s.length > 0 && s.length <= max;
    const boolean = (v: unknown) => typeof v === "boolean";
    const order = (v: unknown) => typeof v === "number" && Number.isFinite(v);
    if (!c || typeof c !== "object" || c.version !== 1 || !Array.isArray(c.groups) || !c.groups.length || c.groups.length > 100 || !Array.isArray(c.manualLinks) || c.manualLinks.length > 2000 || !c.stackLinkOverrides || typeof c.stackLinkOverrides !== "object" || Array.isArray(c.stackLinkOverrides) || !c.settings || typeof c.settings !== "object") {
        throw new Error("Invalid dashboard configuration");
    }
    const ids = new Set<string>();
    for (const g of c.groups) {
        if (!g || !text(g.id, 100) || ids.has(g.id) || !text(g.name, 100) || !order(g.order) || !boolean(g.enabled)) {
            throw new Error("Invalid dashboard group");
        }
        ids.add(g.id);
    }
    const linkIds = new Set<string>();
    for (const l of c.manualLinks) {
        let url: URL;
        try {
            url = new URL(l.url);
        } catch {
            throw new Error("Invalid dashboard URL");
        }
        if (!l || !text(l.id, 100) || !l.id.startsWith("manual:") || linkIds.has(l.id) || !text(l.name, 100) || ![ "http:", "https:" ].includes(url.protocol) || url.username || url.password || !ids.has(l.groupId) || !boolean(l.enabled) || !boolean(l.openInNewTab) || !order(l.order) || l.source !== "manual" || (l.icon != null && (typeof l.icon !== "string" || l.icon.length > 50)) || (l.description != null && (typeof l.description !== "string" || l.description.length > 500))) {
            throw new Error("Invalid dashboard link");
        }
        linkIds.add(l.id);
    }
    for (const [ id, raw ] of Object.entries(c.stackLinkOverrides)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o = raw as any;
        if (!id.startsWith("stack:") || id.length > 1000 || !o || typeof o !== "object" || (o.groupId != null && !ids.has(o.groupId)) || (o.order != null && !order(o.order)) || (o.hidden != null && !boolean(o.hidden)) || (o.icon != null && (typeof o.icon !== "string" || o.icon.length > 50)) || (o.displayName != null && !text(o.displayName, 100))) {
            throw new Error("Invalid stack link override");
        }
    }
    const s = c.settings;
    if (![ s.showStats, s.showUrls, s.showStackUrls, s.showOffline, s.defaultOpenInNewTab, s.statusCheckEnabled ].every(boolean) || s.statusCheckEnabled || ![ "small", "medium", "large" ].includes(s.cardSize) || !(s.columns === "auto" || (Number.isInteger(s.columns) && s.columns >= 1 && s.columns <= 6))) {
        throw new Error("Invalid dashboard settings");
    }
}

export class DashboardConfigStore {
    private filename: string;
    private pending: Promise<void> = Promise.resolve();
    constructor(dataDir: string) {
        this.filename = path.join(dataDir, "dashboard.json");
    }

    async load() {
        try {
            const config: unknown = JSON.parse(await fs.readFile(this.filename, "utf8"));
            validateConfig(config);
            return { config,
                warning: false };
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code === "ENOENT") {
                return { config: defaults(),
                    warning: false };
            }
            log.error("dashboard", `Unable to load dashboard configuration: ${e}`);
            return { config: defaults(),
                warning: true };
        }
    }

    async save(config: unknown) {
        validateConfig(config);
        const save = async () => {
            const current = await this.load();
            if (current.warning) {
                throw new Error("Dashboard configuration is invalid; restore or move the original file before saving.");
            }
            await fs.mkdir(path.dirname(this.filename), { recursive: true });
            const temp = `${this.filename}.${randomUUID()}.tmp`;
            try {
                await fs.writeFile(temp, JSON.stringify(config, null, 4), { mode: 0o600,
                    flag: "wx" });
                await fs.rename(temp, this.filename);
            } finally {
                await fs.rm(temp, { force: true });
            }
        };
        const result = this.pending.then(save);
        this.pending = result.catch(() => {});
        await result;
    }
}
