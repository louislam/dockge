import { DockgeServer } from "./dockge-server";
import fs, { promises as fsAsync } from "fs";
import { log } from "./log";
import yaml from "yaml";
import { DockgeSocket, fileExists, ValidationError } from "./util-server";
import path from "path";
import {
    acceptedComposeFileNames,
    acceptedComposeFileNamePattern,
    ArbitrarilyNestedLooseObject,
    COMBINED_TERMINAL_COLS,
    COMBINED_TERMINAL_ROWS,
    CREATED_FILE,
    CREATED_STACK,
    EXITED, getCombinedTerminalName,
    getComposeTerminalName, getContainerExecTerminalName,
    PROGRESS_TERMINAL_ROWS,
    RUNNING, TERMINAL_ROWS,
    UNKNOWN
} from "../common/util-common";
import { InteractiveTerminal, Terminal } from "./terminal";
import childProcessAsync from "promisify-child-process";
import { Settings } from "./settings";

export class Stack {

    name: string;
    protected _status: number = UNKNOWN;
    protected _composeYAML?: string;
    protected _composeENV?: string;
    protected _configFilePath?: string;
    protected _composeFileName: string = "compose.yaml";
    protected server: DockgeServer;

    protected combinedTerminal? : Terminal;

    protected static managedStackList: Map<string, Stack> = new Map();

    constructor(server : DockgeServer, name : string, composeYAML? : string, composeENV? : string, skipFSOperations = false) {
        this.name = name;
        this.server = server;
        this._composeYAML = composeYAML;
        this._composeENV = composeENV;

        if (!skipFSOperations) {
            // Check if compose file name is different from compose.yaml
            for (const filename of acceptedComposeFileNames) {
                if (fs.existsSync(path.join(this.path, filename))) {
                    this._composeFileName = filename;
                    break;
                }
            }
        }
    }

    async toJSON(endpoint : string) : Promise<object> {

        // Since we have multiple agents now, embed primary hostname in the stack object too.
        let primaryHostname = await Settings.get("primaryHostname");
        if (!primaryHostname) {
            if (!endpoint) {
                primaryHostname = "localhost";
            } else {
                // Use the endpoint as the primary hostname
                try {
                    primaryHostname = (new URL("https://" + endpoint).hostname);
                } catch (e) {
                    // Just in case if the endpoint is in a incorrect format
                    primaryHostname = "localhost";
                }
            }
        }

        let obj = this.toSimpleJSON(endpoint);
        return {
            ...obj,
            composeYAML: this.composeYAML,
            composeENV: this.composeENV,
            primaryHostname,
        };
    }

    toSimpleJSON(endpoint : string) : object {
        return {
            name: this.name,
            status: this._status,
            tags: [],
            isManagedByDockge: this.isManagedByDockge,
            composeFileName: this._composeFileName,
            endpoint,
        };
    }

    /**
     * Get the status of the stack from `docker compose ps --format json`
     */
    async ps() : Promise<object> {
        let res = await childProcessAsync.spawn("docker", this.getComposeOptions("ps", "--format", "json"), {
            cwd: this.path,
            encoding: "utf-8",
        });
        if (!res.stdout) {
            return {};
        }
        return JSON.parse(res.stdout.toString());
    }

    get isManagedByDockge() : boolean {
        return !!this._configFilePath && this._configFilePath.startsWith(this.server.stacksDir);
    }

    get status() : number {
        return this._status;
    }

    validate() {
        // Check name, allows [a-z][0-9] _ - only
        if (!this.name.match(/^[a-z0-9_-]+$/)) {
            throw new ValidationError("Stack name can only contain [a-z][0-9] _ - only");
        }

        // Check YAML format
        yaml.parse(this.composeYAML);

        let lines = this.composeENV.split("\n");

        // Check if the .env is able to pass docker-compose
        // Prevent "setenv: The parameter is incorrect"
        // It only happens when there is one line and it doesn't contain "="
        if (lines.length === 1 && !lines[0].includes("=") && lines[0].length > 0) {
            throw new ValidationError("Invalid .env format");
        }
    }

    get composeYAML() : string {
        if (this._composeYAML === undefined) {
            try {
                this._composeYAML = fs.readFileSync(path.join(this.path, this._composeFileName), "utf-8");
            } catch (e) {
                this._composeYAML = "";
            }
        }
        return this._composeYAML;
    }

    get composeENV() : string {
        if (this._composeENV === undefined) {
            try {
                this._composeENV = fs.readFileSync(path.join(this.path, ".env"), "utf-8");
            } catch (e) {
                this._composeENV = "";
            }
        }
        return this._composeENV;
    }

    get path() : string {
        return this._configFilePath || "";
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
    async save(isAdd : boolean) {
        this.validate();

        let dir = this.path;

        // Check if the name is used if isAdd
        if (isAdd) {
            if (await fileExists(dir)) {
                throw new ValidationError("Stack name already exists");
            }

            // Create the stack folder
            await fsAsync.mkdir(dir);
        } else {
            if (!await fileExists(dir)) {
                throw new ValidationError("Stack not found");
            }
        }

        // Write or overwrite the compose.yaml
        await fsAsync.writeFile(path.join(dir, this._composeFileName), this.composeYAML);

        const envPath = path.join(dir, ".env");

        // Write or overwrite the .env
        // If .env is not existing and the composeENV is empty, we don't need to write it
        if (await fileExists(envPath) || this.composeENV.trim() !== "") {
            await fsAsync.writeFile(envPath, this.composeENV);
        }
    }

    async deploy(socket : DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("up", "-d", "--remove-orphans"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to deploy, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async delete(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("down", "--remove-orphans"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to delete, please check the terminal output for more information.");
        }

        // Remove the stack folder
        await fsAsync.rm(this.path, {
            recursive: true,
            force: true
        });

        return exitCode;
    }

    async updateStatus() {
        let statusList = await Stack.getStatusList();
        let status = statusList.get(this.name);

        if (status) {
            this._status = status;
        } else {
            this._status = UNKNOWN;
        }
    }

    /**
     * Checks if a compose file exists in the specified directory.
     * @async
     * @static
     * @param {string} stacksDir - The directory of the stack.
     * @param {string} filename - The name of the directory to check for the compose file.
     * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether any compose file exists.
     */
    static async composeFileExists(stacksDir : string, filename : string) : Promise<boolean> {
        let filenamePath = path.join(stacksDir, filename);
        // Check if any compose file exists
        for (const filename of acceptedComposeFileNames) {
            let composeFile = path.join(filenamePath, filename);
            if (await fileExists(composeFile)) {
                return true;
            }
        }
        return false;
    }

    static async getStackList(server : DockgeServer, useCacheForManaged = false) : Promise<Map<string, Stack>> {
        let stackList : Map<string, Stack> = new Map<string, Stack>();

        // Use cached stack list?
        if (useCacheForManaged && this.managedStackList.size > 0) {
            stackList = this.managedStackList;
            return stackList;
        }

        // Get status from docker compose ls
        let res = await childProcessAsync.spawn("docker", [ "compose", "ls", "--all", "--format", "json" ], {
            encoding: "utf-8",
        });

        if (!res.stdout) {
            log.warn("getStackList", "No response from docker compose daemon when attempting to retrieve list of stacks");
            return stackList;
        }

        let composeList = JSON.parse(res.stdout.toString());
        let pathSearchTree: ArbitrarilyNestedLooseObject = {}; // search structure for matching paths

        for (let composeStack of composeList) {
            try {
                let stack = new Stack(server, composeStack.Name);
                stack._status = this.statusConvert(composeStack.Status);

                let composeFiles = composeStack.ConfigFiles.split(","); // it is possible for a project to have more than one config file
                stack._configFilePath = path.dirname(composeFiles[0]);
                stack._composeFileName = path.basename(composeFiles[0]);
                if (stack.name === "dockge" && !stack.isManagedByDockge) {
                    // skip dockge if not managed by dockge
                    continue;
                }
                stackList.set(composeStack.Name, stack);

                // add project path to search tree so we can quickly decide if we have seen it before later
                // e.g. path "/opt/stacks" would yield the tree { opt: stacks: {} }
                path.join(stack._configFilePath, stack._composeFileName).split(path.sep).reduce((searchTree, pathComponent) => {
                    if (pathComponent == "") {
                        return searchTree;
                    }
                    if (!searchTree[pathComponent]) {
                        searchTree[pathComponent] = {};
                    }
                    return searchTree[pathComponent];
                }, pathSearchTree);
            } catch (e) {
                if (e instanceof Error) {
                    log.error("getStackList", `Failed to get stack ${composeStack.Name}, error: ${e.message}`);
                }
            }
        }

        // Search stacks directory for compose files not associated with a running compose project (ie. never started through CLI)
        try {
            // Hopefully the user has access to everything in this directory! If they don't, log the error. It is a small price to pay for fast searching.
            let rawFilesList = fs.readdirSync(server.stacksDir, {
                recursive: true,
                withFileTypes: true
            });
            let acceptedComposeFiles = rawFilesList.filter((dirEnt: fs.Dirent) => dirEnt.isFile() && !!dirEnt.name.match(acceptedComposeFileNamePattern));
            log.debug("getStackList", `Folder scan yielded ${acceptedComposeFiles.length} files`);
            for (let composeFile of acceptedComposeFiles) {
                // check if we have seen this file before
                let fullPath = composeFile.parentPath;
                let previouslySeen = fullPath.split(path.sep).reduce((searchTree: ArbitrarilyNestedLooseObject | boolean, pathComponent) => {
                    if (pathComponent == "") {
                        return searchTree;
                    }

                    // end condition
                    if (searchTree == false || !(searchTree as ArbitrarilyNestedLooseObject)[pathComponent]) {
                        return false;
                    }

                    // path (so far) has been previously seen
                    return (searchTree as ArbitrarilyNestedLooseObject)[pathComponent];
                }, pathSearchTree);
                if (!previouslySeen) {
                    // a file with an accepted compose filename has been found that did not appear in `docker compose ls`. Use its config file path as a temp name
                    log.info("getStackList", `Found project unknown to docker compose: ${fullPath}/${composeFile.name}`);
                    let [ configFilePath, configFilename, inferredProjectName ] = [ fullPath, composeFile.name, path.basename(fullPath) ];
                    if (stackList.get(inferredProjectName)) {
                        log.info("getStackList", `... but it was ignored. A project named ${inferredProjectName} already exists`);
                    } else {
                        let stack = new Stack(server, inferredProjectName);
                        stack._status = UNKNOWN;
                        stack._configFilePath = configFilePath;
                        stack._composeFileName = configFilename;
                        stackList.set(inferredProjectName, stack);
                    }
                }
            }
        } catch (e) {
            if (e instanceof Error) {
                log.error("getStackList", `Got error searching for undiscovered stacks:\n${e.message}`);
            }
        }

        this.managedStackList = stackList;
        return stackList;
    }

    /**
     * Get the status list, it will be used to update the status of the stacks
     * Not all status will be returned, only the stack that is deployed or created to `docker compose` will be returned
     */
    static async getStatusList() : Promise<Map<string, number>> {
        let statusList = new Map<string, number>();

        let res = await childProcessAsync.spawn("docker", [ "compose", "ls", "--all", "--format", "json" ], {
            encoding: "utf-8",
        });

        if (!res.stdout) {
            return statusList;
        }

        let composeList = JSON.parse(res.stdout.toString());

        for (let composeStack of composeList) {
            statusList.set(composeStack.Name, this.statusConvert(composeStack.Status));
        }

        return statusList;
    }

    /**
     * Convert the status string from `docker compose ls` to the status number
     * Input Example: "exited(1), running(1)"
     * @param status
     */
    static statusConvert(status : string) : number {
        if (status.startsWith("created")) {
            return CREATED_STACK;
        } else if (status.includes("exited")) {
            // If one of the service is exited, we consider the stack is exited
            return EXITED;
        } else if (status.startsWith("running")) {
            // If there is no exited services, there should be only running services
            return RUNNING;
        } else {
            return UNKNOWN;
        }
    }

    static async getStack(server: DockgeServer, stackName: string, skipFSOperations = false) : Promise<Stack> {
        let stack: Stack | undefined;
        if (!skipFSOperations) {
            let stackList = await this.getStackList(server, true);
            stack = stackList.get(stackName);
            if (!stack || !await fileExists(stack.path) || !(await fsAsync.stat(stack.path)).isDirectory() ) {
                throw new ValidationError(`getStack; Stack ${stackName} not found`);
            }
        } else {
            // search for known stack with this name
            if (this.managedStackList) {
                stack = this.managedStackList.get(stackName);
            }
            if (!this.managedStackList || !stack) {
                stack = new Stack(server, stackName, undefined, undefined, true);
                stack._status = UNKNOWN;
                stack._configFilePath = path.resolve(server.stacksDir, stackName);
            }
        }
        return stack;
    }

    getComposeOptions(command : string, ...extraOptions : string[]) {
        //--env-file ./../global.env --env-file .env
        let options = [ "compose", command, ...extraOptions ];
        if (fs.existsSync(path.join(this.server.stacksDir, "global.env"))) {
            if (fs.existsSync(path.join(this.path, ".env"))) {
                options.splice(1, 0, "--env-file", "./.env");
            }
            options.splice(1, 0, "--env-file", "../global.env");
        }
        console.log(options);
        return options;
    }

    async start(socket: DockgeSocket) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("up", "-d", "--remove-orphans"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to start, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async stop(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("stop"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to stop, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async restart(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("restart"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async down(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("down"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to down, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async update(socket: DockgeSocket) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("pull"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to pull, please check the terminal output for more information.");
        }

        // If the stack is not running, we don't need to restart it
        await this.updateStatus();
        log.debug("update", "Status: " + this.status);
        if (this.status !== RUNNING) {
            return exitCode;
        }

        exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("up", "-d", "--remove-orphans"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async joinCombinedTerminal(socket: DockgeSocket) {
        const terminalName = getCombinedTerminalName(socket.endpoint, this.name);
        const terminal = Terminal.getOrCreateTerminal(this.server, terminalName, "docker", this.getComposeOptions("logs", "-f", "--tail", "100"), this.path);
        terminal.enableKeepAlive = true;
        terminal.rows = COMBINED_TERMINAL_ROWS;
        terminal.cols = COMBINED_TERMINAL_COLS;
        terminal.join(socket);
        terminal.start();
    }

    async leaveCombinedTerminal(socket: DockgeSocket) {
        const terminalName = getCombinedTerminalName(socket.endpoint, this.name);
        const terminal = Terminal.getTerminal(terminalName);
        if (terminal) {
            terminal.leave(socket);
        }
    }

    async joinContainerTerminal(socket: DockgeSocket, serviceName: string, shell : string = "sh", index: number = 0) {
        const terminalName = getContainerExecTerminalName(socket.endpoint, this.name, serviceName, index);
        let terminal = Terminal.getTerminal(terminalName);

        if (!terminal) {
            terminal = new InteractiveTerminal(this.server, terminalName, "docker", this.getComposeOptions("exec", serviceName, shell), this.path);
            terminal.rows = TERMINAL_ROWS;
            log.debug("joinContainerTerminal", "Terminal created");
        }

        terminal.join(socket);
        terminal.start();
    }

    async getServiceStatusList() {
        let statusList = new Map<string, { state: string, ports: string[] }>();

        try {
            let res = await childProcessAsync.spawn("docker", this.getComposeOptions("ps", "--format", "json"), {
                cwd: this.path,
                encoding: "utf-8",
            });

            if (!res.stdout) {
                return statusList;
            }

            let lines = res.stdout?.toString().split("\n");

            for (let line of lines) {
                try {
                    let obj = JSON.parse(line);
                    let ports = (obj.Ports as string).split(/,\s*/).filter((s) => {
                        return s.indexOf("->") >= 0;
                    });
                    if (obj.Health === "") {
                        statusList.set(obj.Service, {
                            state: obj.State,
                            ports: ports
                        });
                    } else {
                        statusList.set(obj.Service, {
                            state: obj.Health,
                            ports: ports
                        });
                    }
                } catch (e) {
                }
            }
            return statusList;
        } catch (e) {
            log.error("getServiceStatusList", e);
            return statusList;
        }
    }
}
