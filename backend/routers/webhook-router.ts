import { DockgeServer } from "../dockge-server";
import { log } from "../log";
import { Router } from "../router";
import express, { Express, Router as ExpressRouter } from "express";
import { Stack } from "../stack";

export class WebhookRouter extends Router {
    create(app: Express, server: DockgeServer): ExpressRouter {
        const router = express.Router();

        router.get("/webhook/update/:stackname", async (req, res, _next) => {
            try {
                const stackname = req.params.stackname;

                log.info("router", `Webhook received for stack: ${stackname}`);
                const stack = await Stack.getStack(server, stackname);
                if (!stack) {
                    log.error("router", `Stack not found: ${stackname}`);
                    res.status(404).json({ message: `Stack not found: ${stackname}` });
                    return;
                }
                await stack.gitSync(undefined);

                // Send a response
                res.json({ message: `Updated stack: ${stackname}` });

            } catch (error) {
                _next(error);
            }
        });

        return router;
    }
}
