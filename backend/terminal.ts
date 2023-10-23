import { DockgeServer } from "./dockge-server";
import * as os from "node:os";
import * as pty from "node-pty";
import { LimitQueue } from "./utils/limit-queue";

const shell = os.platform() === "win32" ? "pwsh.exe" : "bash";

export class Terminal {

    ptyProcess;
    private server : DockgeServer;
    private buffer : LimitQueue<string> = new LimitQueue(100);

    constructor(server : DockgeServer) {
        this.server = server;

        this.ptyProcess = pty.spawn(shell, [], {
            name: "dockge-terminal",
            cwd: "./tmp",
        });

        // this.ptyProcess.write("npm remove lodash\r");
        //this.ptyProcess.write("npm install lodash\r");

        this.ptyProcess.onData((data) => {
            this.buffer.push(data);
            this.server.io.to("terminal").emit("commandOutput", data);
        });

    }

    write(input : string) {
        this.ptyProcess.write(input);
    }

    /**
     * Get the terminal output string for re-connecting
     */
    getBuffer() : string {
        return this.buffer.join("");
    }

}
