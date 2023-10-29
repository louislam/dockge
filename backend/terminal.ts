import { DockgeServer } from "./dockge-server";
import * as os from "node:os";
import * as pty from "@homebridge/node-pty-prebuilt-multiarch";
import { LimitQueue } from "./utils/limit-queue";
import { DockgeSocket } from "./util-server";
import { getCryptoRandomInt, TERMINAL_COLS, TERMINAL_ROWS } from "./util-common";
import { sync as commandExistsSync } from "command-exists";
import { log } from "./log";

/**
 * Terminal for running commands, no user interaction
 */
export class Terminal {

    protected static terminalMap : Map<string, Terminal> = new Map();

    protected _ptyProcess? : pty.IPty;
    protected server : DockgeServer;
    protected buffer : LimitQueue<string> = new LimitQueue(100);
    protected _name : string;

    protected file : string;
    protected args : string | string[];
    protected cwd : string;
    protected callback? : (exitCode : number) => void;

    protected _rows : number = TERMINAL_ROWS;

    constructor(server : DockgeServer, name : string, file : string, args : string | string[], cwd : string) {
        this.server = server;
        this._name = name;
        //this._name = "terminal-" + Date.now() + "-" + getCryptoRandomInt(0, 1000000);
        this.file = file;
        this.args = args;
        this.cwd = cwd;

        Terminal.terminalMap.set(this.name, this);
    }

    get rows() {
        return this._rows;
    }

    set rows(rows : number) {
        this._rows = rows;
        this.ptyProcess?.resize(TERMINAL_COLS, rows);
    }

    public start() {
        if (this._ptyProcess) {
            return;
        }

        this._ptyProcess = pty.spawn(this.file, this.args, {
            name: this.name,
            cwd: this.cwd,
            cols: TERMINAL_COLS,
            rows: this.rows,
        });

        // On Data
        this._ptyProcess.onData((data) => {
            this.buffer.push(data);
            if (this.server.io) {
                this.server.io.to(this.name).emit("terminalWrite", this.name, data);
            }
        });

        // On Exit
        this._ptyProcess.onExit((res) => {
            this.server.io.to(this.name).emit("terminalExit", this.name, res.exitCode);

            // Remove room
            this.server.io.in(this.name).socketsLeave(this.name);

            if (this.callback) {
                this.callback(res.exitCode);
            }

            Terminal.terminalMap.delete(this.name);
            log.debug("Terminal", "Terminal " + this.name + " exited with code " + res.exitCode);
        });
    }

    public onExit(callback : (exitCode : number) => void) {
        this.callback = callback;
    }

    public join(socket : DockgeSocket) {
        socket.join(this.name);
    }

    public leave(socket : DockgeSocket) {
        socket.leave(this.name);
    }

    public get ptyProcess() {
        return this._ptyProcess;
    }

    public get name() {
        return this._name;
    }

    /**
     * Get the terminal output string
     */
    getBuffer() : string {
        if (this.buffer.length === 0) {
            return "";
        }
        return this.buffer.join("");
    }

    close() {
        this._ptyProcess?.kill();
    }

    public static getTerminal(name : string) : Terminal | undefined {
        return Terminal.terminalMap.get(name);
    }
}

/**
 * Interactive terminal
 * Mainly used for container exec
 */
export class InteractiveTerminal extends Terminal {
    public write(input : string) {
        this.ptyProcess?.write(input);
    }

    resetCWD() {
        const cwd = process.cwd();
        this.ptyProcess?.write(`cd "${cwd}"\r`);
    }
}

/**
 * User interactive terminal that use bash or powershell with limited commands such as docker, ls, cd, dir
 */
export class MainTerminal extends InteractiveTerminal {
    constructor(server : DockgeServer, name : string, cwd : string = "./") {
        let shell;

        if (os.platform() === "win32") {
            if (commandExistsSync("pwsh.exe")) {
                shell = "pwsh.exe";
            } else {
                shell = "powershell.exe";
            }
        } else {
            shell = "bash";
        }
        super(server, name, shell, [], cwd);
    }
}
