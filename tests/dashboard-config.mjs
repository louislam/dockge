import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Isolate the store from Dockge's logger so this test can run without dependencies.
const dir = await mkdtemp(path.join(tmpdir(), "dockge-dashboard-test-"));
try {
    const source = await readFile(new URL("../backend/dashboard/config.ts", import.meta.url), "utf8");
    await writeFile(path.join(dir, "config.ts"), source.replace('import { log } from "../log";', 'const log = { error: () => {} };'));
    const { DashboardConfigStore, defaults, validateConfig } = await import(pathToFileURL(path.join(dir, "config.ts")));
    const store = new DashboardConfigStore(dir);
    const config = defaults();
    config.manualLinks.push({ id: "manual:test", name: "Router", url: "http://192.168.1.1", groupId: "lan", enabled: true, openInNewTab: true, order: 1, source: "manual" });
    await store.save(config);
    assert.deepEqual((await new DashboardConfigStore(dir).load()).config, config);
    for (const url of ["javascript:alert(1)", "data:text/html,test", "http://user:pass@example.com"]) {
        assert.throws(() => validateConfig({ ...config, manualLinks: [{ ...config.manualLinks[0], url }] }));
    }
    await writeFile(path.join(dir, "dashboard.json"), "{broken");
    assert.equal((await store.load()).warning, true);
    await assert.rejects(store.save(config));
    assert.equal(await readFile(path.join(dir, "dashboard.json"), "utf8"), "{broken");
    console.log("Dashboard configuration tests passed");
} finally { await rm(dir, { recursive: true, force: true }); }
