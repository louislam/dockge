import { Socket } from "socket.io";

export interface DockgeSocket extends Socket {
    userID: number;
}

export function checkLogin(socket : DockgeSocket) {
    if (!socket.userID) {
        throw new Error("You are not logged in.");
    }
}
