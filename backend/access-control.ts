import { R } from "redbean-node";
import yaml from "yaml";
import { DockgeSocket, ValidationError } from "./util-server";

interface ResourceUsage {
    cpu: number;
    memory: number;
    cpuComplete: boolean;
    memoryComplete: boolean;
}

interface UserLimits {
    cpu_limit: number;
    memory_limit: number;
    role: string;
}

const stackSaveLocks = new Map<number, Promise<void>>();

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return undefined;
}

function parseCpu(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return value;
    }
    if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)) {
        const cpu = Number(value);
        if (Number.isFinite(cpu) && cpu > 0) {
            return cpu;
        }
    }
    return undefined;
}

function parseMemory(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
        return value;
    }
    if (typeof value !== "string") {
        return undefined;
    }

    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(b|k|kb|kib|m|mb|mib|g|gb|gib|t|tb|tib)?$/i);
    if (!match) {
        return undefined;
    }

    const amount = Number(match[1]);
    const unit = (match[2] ?? "b").toLowerCase();
    const multiplier: Record<string, number> = {
        b: 1,
        k: 1000,
        kb: 1000,
        kib: 1024,
        m: 1000 ** 2,
        mb: 1000 ** 2,
        mib: 1024 ** 2,
        g: 1000 ** 3,
        gb: 1000 ** 3,
        gib: 1024 ** 3,
        t: 1000 ** 4,
        tb: 1000 ** 4,
        tib: 1024 ** 4,
    };
    const bytes = amount * multiplier[unit];
    return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : undefined;
}

function getResourceUsage(composeYAML: string, cpuLimited: boolean, memoryLimited: boolean): ResourceUsage {
    let compose: unknown;
    try {
        compose = yaml.parse(composeYAML);
    } catch (error) {
        throw new ValidationError(error instanceof Error ? error.message : "Invalid Compose YAML");
    }

    const composeObject = asRecord(compose);
    const services = asRecord(composeObject?.services);
    let cpuComplete = Boolean(services && Object.keys(services).length > 0);
    let memoryComplete = cpuComplete;
    if ((cpuLimited || memoryLimited) && composeObject && Object.hasOwn(composeObject, "include")) {
        throw new ValidationError("Compose include is not supported while a resource quota is active");
    }
    if (!services || Object.keys(services).length === 0) {
        if (cpuLimited || memoryLimited) {
            throw new ValidationError("Compose file must define at least one service when a resource quota is active");
        }
        return {
            cpu: 0,
            memory: 0,
            cpuComplete: false,
            memoryComplete: false,
        };
    }

    let cpu = 0;
    let memory = 0;
    if (composeObject && Object.hasOwn(composeObject, "include")) {
        cpuComplete = false;
        memoryComplete = false;
    }

    for (const [ serviceName, serviceValue ] of Object.entries(services)) {
        const service = asRecord(serviceValue);
        if (!service) {
            if (cpuLimited || memoryLimited) {
                throw new ValidationError(`Invalid service definition: ${serviceName}`);
            }
            cpuComplete = false;
            memoryComplete = false;
            continue;
        }
        if (cpuLimited && Object.hasOwn(service, "cpus")) {
            throw new ValidationError(`Use deploy.resources.limits.cpus for service "${serviceName}" while a CPU quota is active`);
        }
        if (memoryLimited && Object.hasOwn(service, "mem_limit")) {
            throw new ValidationError(`Use deploy.resources.limits.memory for service "${serviceName}" while a memory quota is active`);
        }
        if (Object.hasOwn(service, "cpus")) {
            cpuComplete = false;
        }
        if (Object.hasOwn(service, "mem_limit")) {
            memoryComplete = false;
        }

        const deploy = asRecord(service.deploy);
        const resources = asRecord(deploy?.resources);
        const limits = asRecord(resources?.limits);
        if ((cpuLimited || memoryLimited) && Object.hasOwn(service, "scale")) {
            throw new ValidationError(`Use deploy.replicas for service "${serviceName}" while a resource quota is active`);
        }
        if ((cpuLimited || memoryLimited) && Object.hasOwn(service, "extends")) {
            throw new ValidationError(`Compose extends is not supported for service "${serviceName}" while a resource quota is active`);
        }
        if (Object.hasOwn(service, "scale") || Object.hasOwn(service, "extends") || deploy?.mode === "global") {
            cpuComplete = false;
            memoryComplete = false;
        }
        if ((cpuLimited || memoryLimited) && deploy?.mode === "global") {
            throw new ValidationError(`Global mode is not supported for service "${serviceName}" while a resource quota is active`);
        }
        const replicas = deploy?.replicas === undefined ? 1 : deploy.replicas;
        if (typeof replicas !== "number" || !Number.isSafeInteger(replicas) || replicas < 0) {
            if (cpuLimited || memoryLimited) {
                throw new ValidationError(`Service "${serviceName}" must define a fixed non-negative deploy.replicas value while a resource quota is active`);
            }
            cpuComplete = false;
            memoryComplete = false;
        }
        const replicaCount = typeof replicas === "number" && Number.isSafeInteger(replicas) && replicas >= 0 ? replicas : 1;

        if (cpuLimited) {
            const serviceCpu = parseCpu(limits?.cpus);
            if (serviceCpu === undefined) {
                throw new ValidationError(`Service "${serviceName}" must define a numeric deploy.resources.limits.cpus value while a CPU quota is active`);
            }
            cpu += serviceCpu * replicaCount;
        } else {
            const serviceCpu = parseCpu(limits?.cpus);
            if (serviceCpu !== undefined) {
                cpu += serviceCpu * replicaCount;
            } else {
                cpuComplete = false;
            }
        }

        if (memoryLimited) {
            const serviceMemory = parseMemory(limits?.memory);
            if (serviceMemory === undefined) {
                throw new ValidationError(`Service "${serviceName}" must define a fixed deploy.resources.limits.memory value while a memory quota is active`);
            }
            memory += serviceMemory * replicaCount;
        } else {
            const serviceMemory = parseMemory(limits?.memory);
            if (serviceMemory !== undefined) {
                memory += serviceMemory * replicaCount;
            } else {
                memoryComplete = false;
            }
        }
    }

    if (!Number.isFinite(cpu) || !Number.isSafeInteger(memory)) {
        throw new ValidationError("Compose resource limits exceed the supported range");
    }
    return {
        cpu,
        memory,
        cpuComplete,
        memoryComplete,
    };
}

export async function requireAdmin(socket: DockgeSocket): Promise<void> {
    if (!socket.userID) {
        throw new Error("You are not logged in.");
    }
    if (!await isAdmin(socket)) {
        throw new Error("Administrator permission is required.");
    }
}

export async function isAdmin(socket: DockgeSocket): Promise<boolean> {
    if (!socket.userID) {
        return false;
    }
    const role = await R.getCell("SELECT role FROM user WHERE id = ? AND active = 1", [ socket.userID ]);
    return role === "admin";
}

export async function requireStackAccess(socket: DockgeSocket, stackName: string, endpoint = socket.endpoint): Promise<void> {
    if (!socket.userID) {
        throw new Error("You are not logged in.");
    }
    const role = await R.getCell("SELECT role FROM user WHERE id = ? AND active = 1", [ socket.userID ]);
    if (role === "admin") {
        return;
    }
    if (endpoint) {
        throw new Error("Only administrators can access remote agents.");
    }
    const ownerID = await R.getCell(
        "SELECT user_id FROM stack_owner WHERE endpoint = ? AND stack_name = ?",
        [ endpoint, stackName ]
    );
    if (Number(ownerID) !== socket.userID) {
        throw new Error("Stack not found or you do not have permission to access it.");
    }
}

export async function requireNewStackAccess(socket: DockgeSocket, stackName: string, endpoint = socket.endpoint): Promise<void> {
    if (!socket.userID) {
        throw new Error("You are not logged in.");
    }
    if (endpoint) {
        await requireAdmin(socket);
        return;
    }
    const ownerID = await R.getCell(
        "SELECT user_id FROM stack_owner WHERE endpoint = ? AND stack_name = ?",
        [ endpoint, stackName ]
    );
    if (ownerID !== undefined && ownerID !== null) {
        await requireStackAccess(socket, stackName, endpoint);
    }
}

export async function requireTerminalAccess(socket: DockgeSocket, stackName?: string): Promise<void> {
    if (!socket.userID) {
        throw new Error("You are not logged in.");
    }
    const role = await R.getCell("SELECT role FROM user WHERE id = ? AND active = 1", [ socket.userID ]);
    if (role === "admin") {
        return;
    }
    if (socket.endpoint) {
        throw new Error("Only administrators can access remote agents.");
    }
    if (!stackName) {
        throw new Error("Terminal not found or you do not have permission to access it.");
    }
    await requireStackAccess(socket, stackName);
}

export async function checkStackQuota(socket: DockgeSocket, stackName: string, composeYAML: string, endpoint = socket.endpoint): Promise<ResourceUsage> {
    const ownerRows = await R.getAll(
        "SELECT user_id, cpu, memory FROM stack_owner WHERE endpoint = ? AND stack_name = ?",
        [ endpoint, stackName ]
    ) as { user_id: number; cpu: number; memory: number }[];
    const owner = ownerRows[0];
    const ownerID = owner?.user_id ?? socket.userID;
    if (ownerID === undefined) {
        throw new Error("You are not logged in.");
    }

    const limitRows = await R.getAll(
        "SELECT cpu_limit, memory_limit, role FROM user WHERE id = ? AND active = 1",
        [ ownerID ]
    ) as UserLimits[];
    const limits = limitRows[0];
    if (!limits) {
        throw new Error("User account is not active.");
    }

    if (limits.role !== "admin") {
        const compose = asRecord(yaml.parse(composeYAML));
        if (compose?.name !== undefined && compose.name !== stackName) {
            throw new ValidationError("Compose project name must match the Dockge stack name");
        }
    }
    const usage = getResourceUsage(composeYAML, limits.cpu_limit > 0, limits.memory_limit > 0);
    if (limits.cpu_limit > 0) {
        const used = Number(await R.getCell(
            "SELECT COALESCE(SUM(cpu), 0) FROM stack_owner WHERE user_id = ? AND endpoint = ? AND stack_name != ?",
            [ ownerID, endpoint, stackName ]
        ));
        if (used + usage.cpu > limits.cpu_limit) {
            throw new ValidationError(`CPU quota exceeded: this stack requests ${usage.cpu} cores, but only ${Math.max(0, limits.cpu_limit - used)} cores remain`);
        }
    }
    if (limits.memory_limit > 0) {
        const used = Number(await R.getCell(
            "SELECT COALESCE(SUM(memory), 0) FROM stack_owner WHERE user_id = ? AND endpoint = ? AND stack_name != ?",
            [ ownerID, endpoint, stackName ]
        ));
        if (used + usage.memory > limits.memory_limit) {
            const remainingMiB = Math.floor(Math.max(0, limits.memory_limit - used) / (1024 ** 2));
            throw new ValidationError(`Memory quota exceeded: this stack requests ${Math.ceil(usage.memory / (1024 ** 2))} MiB, but only ${remainingMiB} MiB remain`);
        }
    }

    return usage;
}

export async function withStackSaveLock<T>(socket: DockgeSocket, stackName: string, work: () => Promise<T>, endpoint = socket.endpoint): Promise<T> {
    const ownerID = await R.getCell(
        "SELECT user_id FROM stack_owner WHERE endpoint = ? AND stack_name = ?",
        [ endpoint, stackName ]
    ) ?? socket.userID;
    if (ownerID === undefined) {
        throw new Error("You are not logged in.");
    }
    const userID = Number(ownerID);
    const previous = stackSaveLocks.get(userID) ?? Promise.resolve();
    let releaseLock: () => void = () => {};
    const current = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });
    stackSaveLocks.set(userID, current);
    await previous;

    try {
        return await work();
    } finally {
        releaseLock();
        if (stackSaveLocks.get(userID) === current) {
            stackSaveLocks.delete(userID);
        }
    }
}

export async function saveStackOwner(socket: DockgeSocket, stackName: string, usage: ResourceUsage, endpoint = socket.endpoint): Promise<void> {
    const ownerRows = await R.getAll(
        "SELECT user_id FROM stack_owner WHERE endpoint = ? AND stack_name = ?",
        [ endpoint, stackName ]
    ) as { user_id: number }[];
    const ownerID = ownerRows[0]?.user_id ?? socket.userID;
    if (ownerID === undefined) {
        throw new Error("You are not logged in.");
    }

    await R.exec(
        `INSERT INTO stack_owner (endpoint, stack_name, user_id, cpu, memory, cpu_complete, memory_complete)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(endpoint, stack_name) DO UPDATE SET
            cpu = excluded.cpu,
            memory = excluded.memory,
            cpu_complete = excluded.cpu_complete,
            memory_complete = excluded.memory_complete`,
        [ endpoint, stackName, ownerID, usage.cpu, usage.memory, usage.cpuComplete, usage.memoryComplete ]
    );
}

export async function deleteStackOwner(stackName: string, endpoint: string): Promise<void> {
    await R.exec("DELETE FROM stack_owner WHERE endpoint = ? AND stack_name = ?", [ endpoint, stackName ]);
}
