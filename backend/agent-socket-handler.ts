import { BockgeServer } from "./bockge-server";
import { AgentSocket } from "../common/agent-socket";
import { BockgeSocket } from "./util-server";

export abstract class AgentSocketHandler {
    abstract create(socket : BockgeSocket, server : BockgeServer, agentSocket : AgentSocket): void;
}
