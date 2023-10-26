import { DockgeServer } from "./dockge-server";
import fs from "fs";
import { log } from "./log";
import yaml from "yaml";
import { DockgeSocket, ValidationError } from "./util-server";
import path from "path";
import { getComposeTerminalName, PROGRESS_TERMINAL_ROWS } from "./util-common";
import { Terminal } from "./terminal";

export class Stack {

    name: string;
    protected _composeYAML?: string;
    protected server: DockgeServer;

    constructor(server : DockgeServer, name : string, composeYAML? : string) {
        this.name = name;
        this.server = server;
        this._composeYAML = composeYAML;
    }

    toJSON() : object {
        let obj = this.toSimpleJSON();
        return {
            ...obj,
            composeYAML: this.composeYAML,
        };
    }

    toSimpleJSON() : object {
        return {
            name: this.name,
            tags: [],
        };
    }

    validate() {
        // Check name, allows [a-z][A-Z][0-9] _ - only
        if (!this.name.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new ValidationError("Stack name can only contain [a-z][A-Z][0-9] _ - only");
        }

        // Check YAML format
        yaml.parse(this.composeYAML);
    }

    get composeYAML() : string {
        if (this._composeYAML === undefined) {
            try {
                this._composeYAML = fs.readFileSync(path.join(this.path, "compose.yaml"), "utf-8");
            } catch (e) {
                this._composeYAML = "";
            }
        }
        return this._composeYAML;
    }

    get path() : string {
        return path.join(this.server.stacksDir, this.name);
    }

    get fullPath() : string {
        let dir = this.path;

        // Compose up via node-pty
        let fullPathDir;

        // if dir is relative, make it absolute
        if (!path.isAbsolute(dir)) {
            fullPathDir = path.join(process.cwd(), dir);
        } else {
            fullPathDir = dir;
        }
        return fullPathDir;
    }

    /**
     * Save the stack to the disk
     * @param isAdd
     */
    save(isAdd : boolean) {
        this.validate();

        let dir = this.path;

        // Check if the name is used if isAdd
        if (isAdd) {
            if (fs.existsSync(dir)) {
                throw new ValidationError("Stack name already exists");
            }

            // Create the stack folder
            fs.mkdirSync(dir);
        } else {
            if (!fs.existsSync(dir)) {
                throw new ValidationError("Stack not found");
            }
        }

        // Write or overwrite the compose.yaml
        fs.writeFileSync(path.join(dir, "compose.yaml"), this.composeYAML);
    }

    async deploy(socket? : DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(this.name);
        log.debug("deployStack", "Terminal name: " + terminalName);

        const terminal = new Terminal(this.server, terminalName, "docker-compose", [ "up", "-d" ], this.path);
        log.debug("deployStack", "Terminal created");

        terminal.rows = PROGRESS_TERMINAL_ROWS;

        if (socket) {
            terminal.join(socket);
            log.debug("deployStack", "Terminal joined");
        } else {
            log.debug("deployStack", "No socket, not joining");
        }

        return new Promise((resolve, reject) => {
            terminal.onExit((exitCode : number) => {
                if (exitCode === 0) {
                    resolve(exitCode);
                } else {
                    reject(new Error("Failed to deploy, please check the terminal output for more information."));
                }
            });
            terminal.start();
        });
    }

    static getStackList(server : DockgeServer) : Stack[] {
        let stacksDir = server.stacksDir;
        let stackList : Stack[] = [];

        // Scan the stacks directory, and get the stack list
        let filenameList = fs.readdirSync(stacksDir);

        log.debug("stack", filenameList);

        for (let filename of filenameList) {
            let relativePath = path.join(stacksDir, filename);
            if (fs.statSync(relativePath).isDirectory()) {
                let stack = new Stack(server, filename);
                stackList.push(stack);
            }
        }
        return stackList;
    }

    static getStack(server: DockgeServer, stackName: string) : Stack {
        let dir = path.join(server.stacksDir, stackName);
        if (!fs.existsSync(dir)) {
            throw new ValidationError("Stack not found");
        }
        return new Stack(server, stackName);
    }
}
