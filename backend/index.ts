import { BockgeServer } from "./bockge-server";
import { log } from "./log";

log.info("server", "Welcome to bockge!");
const server = new BockgeServer();
await server.serve();
