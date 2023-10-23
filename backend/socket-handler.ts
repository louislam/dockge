import { DockgeServer } from "./dockge-server";
import { DockgeSocket } from "./util-server";

export abstract class SocketHandler {
    abstract create(socket : DockgeSocket, server : DockgeServer): void;
}
