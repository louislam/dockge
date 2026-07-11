import { BockgeServer } from "./bockge-server";
import { BockgeSocket } from "./util-server";

export abstract class SocketHandler {
    abstract create(socket : BockgeSocket, server : BockgeServer): void;
}
