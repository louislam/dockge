import assert from "node:assert/strict";
import test from "node:test";
import { Stack } from "../backend/stack.ts";

test("cleanly exited init containers keep a running compose stack running", () => {
    const containers = [
        {
            State: "running",
            Status: "Up 2 minutes"
        },
        {
            State: "exited",
            Status: "Exited (0) 1 minute ago"
        },
    ];

    assert.equal(Stack.isComposeExitClean(containers), true);
});

test("a failed container keeps a compose stack exited", () => {
    const containers = [
        {
            State: "running",
            Status: "Up 2 minutes"
        },
        {
            State: "exited",
            Status: "Exited (1) 1 minute ago"
        },
    ];

    assert.equal(Stack.isComposeExitClean(containers), false);
});

test("a stack with only cleanly exited containers remains exited", () => {
    const containers = [
        {
            State: "exited",
            Status: "Exited (0) 1 minute ago"
        },
    ];

    assert.equal(Stack.isComposeExitClean(containers), false);
});
