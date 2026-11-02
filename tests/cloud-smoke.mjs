import { io } from "socket.io-client";
import assert from "node:assert/strict";

const socket = io(process.env.DOCKGE_TEST_URL || "http://127.0.0.1:15001", { reconnection: false, timeout: 10000 });
const emit = (event, ...args) => new Promise((resolve, reject) => socket.timeout(15000).emit(event, ...args, (error, response) => error ? reject(error) : resolve(response)));
try {
    await new Promise((resolve, reject) => { socket.on("connect", resolve); socket.on("connect_error", reject); });
    assert.equal((await emit("dashboard:get")).ok, false, "dashboard must require login");
    const setup = await emit("setup", "cloudtest", "CloudTest1234!");
    assert.equal(setup.ok, true, JSON.stringify(setup));
    const login = await emit("login", { username: "cloudtest", password: "CloudTest1234!" });
    assert.equal(login.ok, true, JSON.stringify(login));
    const initial = await emit("dashboard:get");
    assert.equal(initial.ok, true);
    const result = await emit("agent", "", "dashboard:stack", "dashboard-demo");
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.links[0].url, "http://127.0.0.1:18080");
    assert.equal(result.runningContainers, 1);
    const config = initial.config;
    config.manualLinks.push({ id: "manual:cloud-smoke", name: "Demo", url: "http://127.0.0.1:18080", groupId: "lan", enabled: true, openInNewTab: true, order: 1, source: "manual" });
    assert.equal((await emit("dashboard:saveConfig", config)).ok, true);
    config.manualLinks[0].url = "javascript:alert(1)";
    assert.equal((await emit("dashboard:saveConfig", config)).ok, false);
    assert.equal((await emit("dashboard:get")).config.manualLinks[0].url, "http://127.0.0.1:18080");
    console.log("Cloud smoke test passed: authentication, Compose URL, container count, configuration and URL validation");
} finally { socket.close(); }
