import { DockgeServer } from "./dockge-server";
import { AgentSocket } from "../common/agent-socket";
import { DockgeSocket } from "./util-server";

export abstract class AgentSocketHandler {
    abstract create(socket : DockgeSocket, server : DockgeServer, agentSocket : AgentSocket): void;
}
