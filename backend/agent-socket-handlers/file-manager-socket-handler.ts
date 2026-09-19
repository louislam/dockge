import { promises as fsAsync } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { AgentSocketHandler } from "../agent-socket-handler";
import { DockgeServer } from "../dockge-server";
import { AgentSocket } from "../../common/agent-socket";
import { checkLogin, DockgeSocket } from "../util-server";
import { FILE_MANAGER_CHUNK_SIZE, FILE_MANAGER_TEXT_LIMIT, FileManagerError } from "../file-manager";
import { log } from "../log";

interface DownloadSession {
    handle: FileHandle;
    nextOffset: number;
    size: number;
}

interface UploadSession {
    handle: FileHandle;
    nextOffset: number;
    size: number;
    temporary: string;
    target: string;
    overwrite: boolean;
    relative: string;
}

interface FileManagerRequest {
    path?: unknown;
    source?: unknown;
    destination?: unknown;
    overwrite?: boolean;
    confirmed?: boolean;
    offset?: number;
    limit?: number;
    size?: number;
    content?: unknown;
    revision?: unknown;
    force?: boolean;
    transferId?: string;
    data?: unknown;
    fileId?: unknown;
}

export class FileManagerSocketHandler extends AgentSocketHandler {
    create(socket : DockgeSocket, server : DockgeServer, agentSocket : AgentSocket) {
        const downloads = new Map<string, DownloadSession>();
        const uploads = new Map<string, UploadSession>();

        const audit = (operation : string, paths : unknown[], result : "success" | "failure", code? : string) => {
            const safePaths = paths.filter(item => typeof item === "string").map(item => JSON.stringify(item)).join(",");
            log.info("file-manager", `user=${socket.userID} endpoint=${socket.endpoint || "current"} operation=${operation} paths=${safePaths} result=${result}${code ? ` code=${code}` : ""}`);
        };

        const respond = async (callback : unknown, action : () => Promise<object | void>, auditEntry? : { operation: string; paths: unknown[] | (() => unknown[]) }) => {
            let auditPaths : unknown[] = [];
            try {
                checkLogin(socket);
                if (typeof callback !== "function") {
                    return;
                }
                auditPaths = auditEntry ? (typeof auditEntry.paths === "function" ? auditEntry.paths() : auditEntry.paths) : [];
                const result = await action();
                if (auditEntry) {
                    audit(auditEntry.operation, auditPaths, "success");
                }
                callback({ ok: true,
                    ...result });
            } catch (error) {
                if (typeof callback !== "function") {
                    return;
                }
                if (!(error instanceof FileManagerError)) {
                    log.error("file-manager", error);
                }
                const code = fileManagerErrorCode(error);
                if (auditEntry) {
                    audit(auditEntry.operation, auditPaths, "failure", code);
                }
                const messageKey = fileManagerErrorMessage(code);
                callback({
                    ok: false,
                    code,
                    msg: messageKey || (error instanceof FileManagerError ? error.message : "File manager operation failed."),
                    msgi18n: Boolean(messageKey),
                });
            }
        };

        const manager = () => {
            if (!server.fileManager) {
                throw new FileManagerError("FILE_MANAGER_DISABLED", "File manager is not configured on this node.");
            }
            return server.fileManager;
        };

        agentSocket.on("fileManagerInfo", async (callback) => respond(callback, async () => ({
            enabled: Boolean(server.fileManager),
            maxFileSize: server.fileManager?.maxFileSize || server.config.fileManagerMaxFileSize,
            textFileSize: FILE_MANAGER_TEXT_LIMIT,
            chunkSize: FILE_MANAGER_CHUNK_SIZE,
        })));

        agentSocket.on("fileList", async (request : FileManagerRequest, callback) => respond(callback, async () => manager().list(request?.path || "", request?.offset, request?.limit)));
        agentSocket.on("fileCreateDirectory", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            await manager().createDirectory(request?.path);
            return { msg: "folderCreatedSuccessfully",
                msgi18n: true };
        }, { operation: "create-directory",
            paths: [ request?.path ] }));
        agentSocket.on("fileCreateTextFile", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            await manager().createTextFile(request?.path);
            return { msg: "textFileCreatedSuccessfully",
                msgi18n: true };
        }, { operation: "create-text-file",
            paths: [ request?.path ] }));
        agentSocket.on("fileRename", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            await manager().move(request?.source, request?.destination, request?.overwrite === true);
            return { msg: "fileRenamedSuccessfully",
                msgi18n: true };
        }, { operation: "rename",
            paths: [ request?.source, request?.destination ] }));
        agentSocket.on("fileMove", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            await manager().move(request?.source, request?.destination, request?.overwrite === true);
            return { msg: "fileMovedSuccessfully",
                msgi18n: true };
        }, { operation: "move",
            paths: [ request?.source, request?.destination ] }));
        agentSocket.on("fileDelete", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            await manager().remove(request?.path, request?.confirmed === true);
            return { msg: "fileDeletedSuccessfully",
                msgi18n: true };
        }, { operation: "delete",
            paths: [ request?.path ] }));
        agentSocket.on("fileReadText", async (request : FileManagerRequest, callback) => respond(callback, async () => manager().readText(request?.path)));
        agentSocket.on("fileLogRead", async (request : FileManagerRequest, callback) => respond(callback, async () => manager().readLog(request?.path, request?.offset, request?.fileId)));
        agentSocket.on("fileSaveText", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            return { ...await manager().saveText(request?.path, request?.content, request?.revision, request?.force === true),
                msg: "fileSavedSuccessfully",
                msgi18n: true };
        }, { operation: "save-text",
            paths: [ request?.path ] }));

        agentSocket.on("fileDownloadStart", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            const prepared = await manager().prepareDownload(request?.path);
            const transferId = randomUUID();
            downloads.set(transferId, { handle: prepared.handle,
                nextOffset: 0,
                size: prepared.stat.size });
            return { transferId,
                size: prepared.stat.size,
                name: pathName(prepared.relative) };
        }));
        agentSocket.on("fileDownloadChunk", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            const id = requireTransferId(request);
            const session = downloads.get(id);
            if (!session) {
                throw new FileManagerError("TRANSFER_NOT_FOUND", "The download session no longer exists.");
            }
            if (request?.offset !== session.nextOffset) {
                throw new FileManagerError("INVALID_OFFSET", "Unexpected download offset.");
            }
            const length = Math.min(FILE_MANAGER_CHUNK_SIZE, session.size - session.nextOffset);
            const buffer = Buffer.alloc(Math.max(0, length));
            const result = length > 0 ? await session.handle.read(buffer, 0, length, session.nextOffset) : { bytesRead: 0 };
            if (length > 0 && result.bytesRead === 0) {
                downloads.delete(id);
                await session.handle.close();
                throw new FileManagerError("TRANSFER_CHANGED", "The file changed during download.");
            }
            const offset = session.nextOffset;
            session.nextOffset += result.bytesRead;
            return { data: buffer.subarray(0, result.bytesRead),
                offset,
                done: session.nextOffset >= session.size };
        }));
        agentSocket.on("fileDownloadFinish", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            const id = requireTransferId(request);
            const session = downloads.get(id);
            if (session) {
                downloads.delete(id);
                await session.handle.close();
            }
        }));

        agentSocket.on("fileUploadStart", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            const prepared = await manager().prepareUpload(request?.path, request?.size, request?.overwrite === true);
            const transferId = randomUUID();
            uploads.set(transferId, {
                handle: prepared.handle,
                nextOffset: 0,
                size: prepared.size,
                temporary: prepared.temporary,
                target: prepared.absolute,
                overwrite: request?.overwrite === true,
                relative: prepared.relative,
            });
            return { transferId };
        }));
        agentSocket.on("fileUploadChunk", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            const id = requireTransferId(request);
            const session = uploads.get(id);
            if (!session) {
                throw new FileManagerError("TRANSFER_NOT_FOUND", "The upload session no longer exists.");
            }
            if (request?.offset !== session.nextOffset) {
                throw new FileManagerError("INVALID_OFFSET", "Unexpected upload offset.");
            }
            let buffer : Buffer;
            if (Buffer.isBuffer(request.data)) {
                buffer = request.data;
            } else if (request.data instanceof Uint8Array) {
                buffer = Buffer.from(request.data);
            } else if (request.data instanceof ArrayBuffer) {
                buffer = Buffer.from(request.data);
            } else {
                throw new FileManagerError("INVALID_CHUNK", "The upload chunk is invalid.");
            }
            if (buffer.byteLength > FILE_MANAGER_CHUNK_SIZE || session.nextOffset + buffer.byteLength > session.size) {
                throw new FileManagerError("INVALID_CHUNK", "The upload chunk is invalid.");
            }
            await session.handle.write(buffer, 0, buffer.byteLength, session.nextOffset);
            session.nextOffset += buffer.byteLength;
            return { offset: session.nextOffset };
        }));
        agentSocket.on("fileUploadFinish", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            const id = requireTransferId(request);
            const session = uploads.get(id);
            if (!session) {
                throw new FileManagerError("TRANSFER_NOT_FOUND", "The upload session no longer exists.");
            }
            if (session.nextOffset !== session.size) {
                throw new FileManagerError("INCOMPLETE_UPLOAD", "The upload is incomplete.");
            }
            uploads.delete(id);
            await session.handle.close();
            try {
                await manager().commitUpload(session.temporary, session.target, session.overwrite);
            } catch (error) {
                await fsAsync.rm(session.temporary, { force: true }).catch(() => {});
                throw error;
            }
            return { msg: "fileUploadedSuccessfully",
                msgi18n: true };
        }, { operation: "upload",
            paths: () => [ typeof request?.transferId === "string" ? uploads.get(request.transferId)?.relative : undefined ] }));
        agentSocket.on("fileUploadAbort", async (request : FileManagerRequest, callback) => respond(callback, async () => {
            await cleanupUpload(request?.transferId, uploads);
        }));

        socket.on("disconnect", async () => {
            await Promise.all([ ...downloads.values() ].map(session => session.handle.close().catch(() => {})));
            await Promise.all([ ...uploads.keys() ].map(id => cleanupUpload(id, uploads)));
            downloads.clear();
        });
    }
}

function fileManagerErrorMessage(code : string) {
    return ({
        TEXT_TOO_LARGE: "fileErrorTextTooLarge",
        NOT_UTF8: "fileErrorNotUtf8",
        NOT_TEXT: "fileErrorNotText",
        NOT_FOUND: "fileErrorNotFound",
        NOT_FILE: "fileErrorNotFile",
        SYMLINK_NOT_ALLOWED: "fileErrorSymlink",
        TRANSFER_CHANGED: "fileErrorChanged",
        PERMISSION_DENIED: "fileErrorPermission",
        FILE_MANAGER_ERROR: "fileErrorGeneric",
    } as Record<string, string>)[code];
}

function fileManagerErrorCode(error : unknown) {
    if (error instanceof FileManagerError) {
        return error.code;
    }
    const systemCode = (error as NodeJS.ErrnoException)?.code;
    if (systemCode === "ENOENT") {
        return "NOT_FOUND";
    }
    if (systemCode === "EACCES" || systemCode === "EPERM") {
        return "PERMISSION_DENIED";
    }
    return "FILE_MANAGER_ERROR";
}

async function cleanupUpload(id : unknown, uploads : Map<string, UploadSession>) {
    if (typeof id !== "string") {
        return;
    }
    const session = uploads.get(id);
    if (!session) {
        return;
    }
    uploads.delete(id);
    await session.handle.close().catch(() => {});
    await fsAsync.rm(session.temporary, { force: true }).catch(() => {});
}

function pathName(relative : string) {
    return relative.replace(/\\/g, "/").split("/").pop() || "download";
}

function requireTransferId(request : FileManagerRequest) {
    if (typeof request.transferId !== "string") {
        throw new FileManagerError("VALIDATION", "A transfer id is required.");
    }
    return request.transferId;
}
