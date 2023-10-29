import { DockgeServer } from "./dockge-server";
import fs from "fs";
import { log } from "./log";
import yaml from "yaml";
import { DockgeSocket, ValidationError } from "./util-server";
import path from "path";
import {
    CREATED_FILE,
    CREATED_STACK,
    EXITED,
    getComposeTerminalName,
    PROGRESS_TERMINAL_ROWS,
    RUNNING,
    UNKNOWN
} from "./util-common";
import { Terminal } from "./terminal";
import childProcess from "child_process";

export class Stack {

    name: string;
    protected _status: number = UNKNOWN;
    protected _composeYAML?: string;
    protected _configFilePath?: string;
    protected server: DockgeServer;

    protected static managedStackList: Map<string, Stack> = new Map();

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
            isManagedByDockge: this.isManagedByDockge,
        };
    }

    toSimpleJSON() : object {
        return {
            name: this.name,
            status: this._status,
            tags: [],
        };
    }

    get isManagedByDockge() : boolean {
        if (this._configFilePath) {
            return this._configFilePath.startsWith(this.server.stackDirFullPath) && fs.existsSync(this.path) && fs.statSync(this.path).isDirectory();
        } else {
            return false;
        }
    }

    get status() : number {
        return this._status;
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

    deploy(socket? : DockgeSocket) : Promise<number> {
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

    delete(socket?: DockgeSocket) : Promise<number> {
        // Docker compose down
        const terminalName = getComposeTerminalName(this.name);
        log.debug("deleteStack", "Terminal name: " + terminalName);

        const terminal = new Terminal(this.server, terminalName, "docker-compose", [ "down" ], this.path);

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
                    // Remove the stack folder
                    try {
                        fs.rmSync(this.path, {
                            recursive: true,
                            force: true
                        });
                        resolve(exitCode);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error("Failed to delete, please check the terminal output for more information."));
                }
            });
            terminal.start();
        });

    }

    static getStackList(server : DockgeServer, useCacheForManaged = false) : Map<string, Stack> {
        let stacksDir = server.stacksDir;
        let stackList : Map<string, Stack>;

        if (useCacheForManaged && this.managedStackList.size > 0) {
            stackList = this.managedStackList;
        } else {
            stackList = new Map<string, Stack>();

            // Scan the stacks directory, and get the stack list
            let filenameList = fs.readdirSync(stacksDir);

            for (let filename of filenameList) {
                try {
                    let stack = this.getStack(server, filename);
                    stack._status = CREATED_FILE;
                    stackList.set(filename, stack);
                } catch (e) {
                    log.warn("getStackList", `Failed to get stack ${filename}, error: ${e.message}`);
                }
            }

            // Cache by copying
            this.managedStackList = new Map(stackList);
        }

        // Also get the list from `docker compose ls --all --format json`
        let res = childProcess.execSync("docker compose ls --all --format json");
        let composeList = JSON.parse(res.toString());

        for (let composeStack of composeList) {
            let stack = stackList.get(composeStack.Name);

            // This stack probably is not managed by Dockge, but we still want to show it
            if (!stack) {
                stack = new Stack(server, composeStack.Name);
                stackList.set(composeStack.Name, stack);
            }

            stack._status = this.statusConvert(composeStack.Status);
            stack._configFilePath = composeStack.ConfigFiles;
        }

        return stackList;
    }

    /**
     * Get the status list, it will be used to update the status of the stacks
     * Not all status will be returned, only the stack that is deployed or created to `docker compose` will be returned
     */
    static getStatusList() : Map<string, number> {
        let statusList = new Map<string, number>();

        let res = childProcess.execSync("docker compose ls --all --format json");
        let composeList = JSON.parse(res.toString());

        for (let composeStack of composeList) {
            statusList.set(composeStack.Name, this.statusConvert(composeStack.Status));
        }

        return statusList;
    }

    static statusConvert(status : string) : number {
        if (status.startsWith("created")) {
            return CREATED_STACK;
        } else if (status.startsWith("running")) {
            return RUNNING;
        } else if (status.startsWith("exited")) {
            return EXITED;
        } else {
            return UNKNOWN;
        }
    }

    static getStack(server: DockgeServer, stackName: string) : Stack {
        let dir = path.join(server.stacksDir, stackName);

        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            // Maybe it is a stack managed by docker compose directly
            let stackList = this.getStackList(server);
            let stack = stackList.get(stackName);

            if (stack) {
                return stack;
            } else {
                // Really not found
                throw new ValidationError("Stack not found");
            }
        }

        let stack = new Stack(server, stackName);
        stack._status = UNKNOWN;
        stack._configFilePath = path.resolve(dir);
        return stack;
    }
}
