import fs, { promises as fsAsync } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { isKnownBinaryFileName } from "../common/file-types";

export const FILE_MANAGER_CHUNK_SIZE = 256 * 1024;
export const FILE_MANAGER_TEXT_LIMIT = 1024 * 1024;
export const FILE_MANAGER_LOG_TAIL_SIZE = 512 * 1024;
export const FILE_MANAGER_LOG_BACKLOG_LIMIT = 2 * 1024 * 1024;

export class FileManagerError extends Error {
    code : string;

    constructor(code : string, message : string) {
        super(message);
        this.code = code;
    }
}

export interface FileManagerEntry {
    name: string;
    path: string;
    type: "directory" | "file" | "symlink" | "other";
    size: number;
    modifiedAt: number;
}

/**
 * Filesystem operations constrained to a single, canonical root directory.
 */
export class FileManager {
    readonly root : string;
    readonly maxFileSize : number;

    constructor(root : string, maxFileSize : number) {
        const stat = fs.statSync(root);
        if (!stat.isDirectory()) {
            throw new Error(`File manager root is not a directory: ${root}`);
        }
        this.root = fs.realpathSync(root);
        this.maxFileSize = maxFileSize;
    }

    normalizeRelative(input : unknown, allowRoot = true) : string {
        if (typeof input !== "string") {
            throw new FileManagerError("VALIDATION", "Path must be a string.");
        }
        if (input.includes("\0")) {
            throw new FileManagerError("VALIDATION", "Path contains an invalid character.");
        }

        const portable = input.replace(/\\/g, "/");
        if (portable.startsWith("/") || /^[A-Za-z]:/.test(portable)) {
            throw new FileManagerError("PATH_OUTSIDE_ROOT", "Absolute paths are not allowed.");
        }

        const segments = portable.split("/").filter(segment => segment !== "" && segment !== ".");
        if (segments.some(segment => segment === "..")) {
            throw new FileManagerError("PATH_OUTSIDE_ROOT", "The path is outside the configured root.");
        }

        const relative = segments.join(path.sep);
        if (!allowRoot && relative === "") {
            throw new FileManagerError("ROOT_PROTECTED", "The configured root cannot be modified.");
        }
        return relative;
    }

    private assertInsideRoot(absolutePath : string) {
        const relative = path.relative(this.root, absolutePath);
        if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
            return;
        }
        throw new FileManagerError("PATH_OUTSIDE_ROOT", "The path is outside the configured root.");
    }

    private async assertNoSymlinkParents(relative : string, includeLeaf : boolean) {
        const segments = relative.split(path.sep).filter(Boolean);
        const limit = includeLeaf ? segments.length : Math.max(0, segments.length - 1);
        let current = this.root;
        for (let index = 0; index < limit; index++) {
            current = path.join(current, segments[index]);
            let stat;
            try {
                stat = await fsAsync.lstat(current);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    throw new FileManagerError("NOT_FOUND", "A parent directory does not exist.");
                }
                throw error;
            }
            if (stat.isSymbolicLink()) {
                throw new FileManagerError("SYMLINK_NOT_ALLOWED", "Symbolic links cannot be traversed.");
            }
            if (index < limit - 1 && !stat.isDirectory()) {
                throw new FileManagerError("NOT_DIRECTORY", "A parent path is not a directory.");
            }
        }
    }

    async resolveExisting(input : unknown, allowRoot = true, allowSymlinkLeaf = false) : Promise<{ relative: string; absolute: string; stat: fs.Stats }> {
        const relative = this.normalizeRelative(input, allowRoot);
        const absolute = path.resolve(this.root, relative);
        this.assertInsideRoot(absolute);
        await this.assertNoSymlinkParents(relative, !allowSymlinkLeaf);
        let stat;
        try {
            stat = await fsAsync.lstat(absolute);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                throw new FileManagerError("NOT_FOUND", "The file or directory does not exist.");
            }
            throw error;
        }
        if (stat.isSymbolicLink() && !allowSymlinkLeaf) {
            throw new FileManagerError("SYMLINK_NOT_ALLOWED", "This operation is not allowed for symbolic links.");
        }
        return { relative,
            absolute,
            stat };
    }

    async resolveTarget(input : unknown, allowRoot = false) : Promise<{ relative: string; absolute: string; parent: string }> {
        const relative = this.normalizeRelative(input, allowRoot);
        const absolute = path.resolve(this.root, relative);
        this.assertInsideRoot(absolute);
        await this.assertNoSymlinkParents(relative, false);
        const parent = path.dirname(absolute);
        const parentReal = await fsAsync.realpath(parent).catch(() => {
            throw new FileManagerError("NOT_FOUND", "The destination directory does not exist.");
        });
        this.assertInsideRoot(parentReal);
        const parentStat = await fsAsync.stat(parentReal);
        if (!parentStat.isDirectory()) {
            throw new FileManagerError("NOT_DIRECTORY", "The destination parent is not a directory.");
        }
        return { relative,
            absolute,
            parent };
    }

    async list(input : unknown, offset = 0, limit = 200) {
        const resolved = await this.resolveExisting(input);
        if (!resolved.stat.isDirectory()) {
            throw new FileManagerError("NOT_DIRECTORY", "The selected path is not a directory.");
        }
        const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
        const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 500) : 200;
        const dirents = await fsAsync.readdir(resolved.absolute, { withFileTypes: true });
        const entries : FileManagerEntry[] = [];
        for (const dirent of dirents) {
            const absolute = path.join(resolved.absolute, dirent.name);
            const stat = await fsAsync.lstat(absolute);
            const type = stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other";
            entries.push({
                name: dirent.name,
                path: path.posix.join(resolved.relative.split(path.sep).join("/"), dirent.name),
                type,
                size: stat.isFile() ? stat.size : 0,
                modifiedAt: stat.mtimeMs,
            });
        }
        entries.sort((left, right) => {
            if (left.type === "directory" && right.type !== "directory") {
                return -1;
            }
            if (left.type !== "directory" && right.type === "directory") {
                return 1;
            }
            return left.name.localeCompare(right.name, undefined, { numeric: true,
                sensitivity: "base" });
        });
        return {
            path: resolved.relative.split(path.sep).join("/"),
            entries: entries.slice(safeOffset, safeOffset + safeLimit),
            total: entries.length,
            offset: safeOffset,
            limit: safeLimit,
        };
    }

    async createDirectory(input : unknown) {
        const target = await this.resolveTarget(input);
        await fsAsync.mkdir(target.absolute);
    }

    async createTextFile(input : unknown) {
        const target = await this.resolveTarget(input);
        const handle = await fsAsync.open(target.absolute, "wx");
        await handle.close();
    }

    async remove(input : unknown, confirmed : boolean) {
        if (!confirmed) {
            throw new FileManagerError("CONFIRMATION_REQUIRED", "Deletion must be confirmed.");
        }
        const source = await this.resolveExisting(input, false, true);
        if (source.stat.isDirectory() && !source.stat.isSymbolicLink()) {
            await fsAsync.rm(source.absolute, { recursive: true,
                force: false });
        } else {
            await fsAsync.unlink(source.absolute);
        }
    }

    async move(sourceInput : unknown, destinationInput : unknown, overwrite = false) {
        const source = await this.resolveExisting(sourceInput, false, true);
        const destination = await this.resolveTarget(destinationInput);
        const destinationStat = await fsAsync.lstat(destination.absolute).catch(error => {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return null;
            }
            throw error;
        });

        let destinationBackup : string | null = null;
        if (destinationStat) {
            if (!overwrite) {
                throw new FileManagerError("CONFLICT", "The destination already exists.");
            }
            if (!source.stat.isFile() || !destinationStat.isFile() || source.stat.isSymbolicLink() || destinationStat.isSymbolicLink()) {
                throw new FileManagerError("DIRECTORY_CONFLICT", "Directories and symbolic links cannot be overwritten.");
            }
            destinationBackup = path.join(destination.parent, `.dockge-move-backup-${randomUUID()}.tmp`);
            await fsAsync.rename(destination.absolute, destinationBackup);
        }

        try {
            try {
                await fsAsync.rename(source.absolute, destination.absolute);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
                    throw error;
                }
                try {
                    await fsAsync.cp(source.absolute, destination.absolute, { recursive: source.stat.isDirectory(),
                        errorOnExist: true,
                        force: false,
                        dereference: false });
                    await fsAsync.rm(source.absolute, { recursive: source.stat.isDirectory(),
                        force: false });
                } catch (copyError) {
                    await fsAsync.rm(destination.absolute, { recursive: true,
                        force: true }).catch(() => {});
                    throw copyError;
                }
            }
            if (destinationBackup) {
                await fsAsync.rm(destinationBackup, { force: true }).catch(() => {});
            }
        } catch (error) {
            if (destinationBackup) {
                await fsAsync.rm(destination.absolute, { recursive: true,
                    force: true }).catch(() => {});
                await fsAsync.rename(destinationBackup, destination.absolute).catch(() => {});
            }
            throw error;
        }
    }

    async readText(input : unknown) {
        const source = await this.resolveExisting(input, false);
        if (!source.stat.isFile()) {
            throw new FileManagerError("NOT_FILE", "The selected path is not a regular file.");
        }
        if (source.stat.size > FILE_MANAGER_TEXT_LIMIT) {
            throw new FileManagerError("TEXT_TOO_LARGE", "Text files larger than 1 MiB cannot be edited.");
        }
        const buffer = await fsAsync.readFile(source.absolute);
        let content;
        try {
            content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        } catch {
            throw new FileManagerError("NOT_UTF8", "Only UTF-8 text files can be edited.");
        }
        if (isKnownBinaryFileName(source.relative) || hasBinaryBytes(buffer)) {
            throw new FileManagerError("NOT_TEXT", "Binary files cannot be edited as text.");
        }
        return { content,
            revision: this.hash(buffer),
            modifiedAt: source.stat.mtimeMs };
    }

    async saveText(input : unknown, content : unknown, expectedRevision : unknown, force = false) {
        if (typeof content !== "string") {
            throw new FileManagerError("VALIDATION", "Text content must be a string.");
        }
        const buffer = Buffer.from(content, "utf-8");
        if (buffer.byteLength > FILE_MANAGER_TEXT_LIMIT) {
            throw new FileManagerError("TEXT_TOO_LARGE", "Text files larger than 1 MiB cannot be edited.");
        }
        const source = await this.resolveExisting(input, false);
        if (!source.stat.isFile()) {
            throw new FileManagerError("NOT_FILE", "The selected path is not a regular file.");
        }
        const current = await fsAsync.readFile(source.absolute);
        if (!force && (typeof expectedRevision !== "string" || this.hash(current) !== expectedRevision)) {
            throw new FileManagerError("CONFLICT", "The file changed after it was opened.");
        }
        const temporary = path.join(path.dirname(source.absolute), `.dockge-edit-${randomUUID()}.tmp`);
        try {
            await fsAsync.writeFile(temporary, buffer, { flag: "wx" });
            await fsAsync.rename(temporary, source.absolute);
        } finally {
            await fsAsync.rm(temporary, { force: true }).catch(() => {});
        }
        return { revision: this.hash(buffer) };
    }

    async readLog(input : unknown, offsetInput? : unknown, fileIdInput? : unknown) {
        const source = await this.resolveExisting(input, false);
        if (!source.stat.isFile()) {
            throw new FileManagerError("NOT_FILE", "The selected path is not a regular file.");
        }
        if (isKnownBinaryFileName(source.relative)) {
            throw new FileManagerError("NOT_TEXT", "Binary files cannot be viewed as text.");
        }
        if (offsetInput !== undefined && (!Number.isSafeInteger(offsetInput) || (offsetInput as number) < 0)) {
            throw new FileManagerError("VALIDATION", "The log offset is invalid.");
        }
        if (fileIdInput !== undefined && typeof fileIdInput !== "string") {
            throw new FileManagerError("VALIDATION", "The log file id is invalid.");
        }

        const realPath = await fsAsync.realpath(source.absolute);
        this.assertInsideRoot(realPath);
        const handle = await fsAsync.open(realPath, "r");
        try {
            const stat = await handle.stat();
            if (!stat.isFile()) {
                throw new FileManagerError("NOT_FILE", "The selected path is not a regular file.");
            }

            const size = stat.size;
            const fileId = this.fileId(stat);
            const requestedOffset = offsetInput as number | undefined;
            let offset = requestedOffset ?? Math.max(0, size - FILE_MANAGER_LOG_TAIL_SIZE);
            let reset = requestedOffset === undefined;
            let skippedBytes = 0;

            if (requestedOffset !== undefined && (fileIdInput !== fileId || size < requestedOffset)) {
                offset = Math.max(0, size - FILE_MANAGER_LOG_TAIL_SIZE);
                reset = true;
            } else if (requestedOffset !== undefined && size - requestedOffset > FILE_MANAGER_LOG_BACKLOG_LIMIT) {
                offset = Math.max(requestedOffset, size - FILE_MANAGER_LOG_TAIL_SIZE);
                skippedBytes = offset - requestedOffset;
            }

            const chunk = await this.readUtf8Chunk(handle, offset, size);
            return {
                content: chunk.content,
                offset: chunk.offset,
                nextOffset: chunk.nextOffset,
                size,
                fileId,
                reset,
                hasMore: chunk.nextOffset < size,
                modifiedAt: stat.mtimeMs,
                ...(skippedBytes > 0 ? { skippedBytes } : {}),
            };
        } finally {
            await handle.close();
        }
    }

    async prepareDownload(input : unknown) {
        const source = await this.resolveExisting(input, false);
        if (!source.stat.isFile()) {
            throw new FileManagerError("NOT_FILE", "Only regular files can be downloaded.");
        }
        if (source.stat.size > this.maxFileSize) {
            throw new FileManagerError("FILE_TOO_LARGE", "The file exceeds the configured transfer limit.");
        }
        return { ...source,
            handle: await fsAsync.open(source.absolute, "r") };
    }

    async prepareUpload(input : unknown, size : unknown, overwrite = false) {
        if (!Number.isInteger(size) || (size as number) < 0 || (size as number) > this.maxFileSize) {
            throw new FileManagerError("FILE_TOO_LARGE", "The file exceeds the configured transfer limit.");
        }
        const target = await this.resolveTarget(input);
        const existing = await fsAsync.lstat(target.absolute).catch(error => {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return null;
            }
            throw error;
        });
        if (existing) {
            if (!overwrite) {
                throw new FileManagerError("CONFLICT", "The destination already exists.");
            }
            if (!existing.isFile() || existing.isSymbolicLink()) {
                throw new FileManagerError("DIRECTORY_CONFLICT", "Only regular files can be overwritten.");
            }
        }
        const temporary = path.join(target.parent, `.dockge-upload-${randomUUID()}.tmp`);
        return { ...target,
            size: size as number,
            temporary,
            handle: await fsAsync.open(temporary, "wx") };
    }

    async commitUpload(temporary : string, target : string, overwrite : boolean) {
        this.assertInsideRoot(temporary);
        this.assertInsideRoot(target);
        const parentReal = await fsAsync.realpath(path.dirname(target));
        this.assertInsideRoot(parentReal);
        const existing = await fsAsync.lstat(target).catch(error => {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return null;
            }
            throw error;
        });
        if (existing) {
            if (!overwrite) {
                throw new FileManagerError("CONFLICT", "The destination changed during upload.");
            }
            if (!existing.isFile() || existing.isSymbolicLink()) {
                throw new FileManagerError("DIRECTORY_CONFLICT", "Only regular files can be overwritten.");
            }
        }
        if (!existing) {
            await fsAsync.rename(temporary, target);
            return;
        }

        const backup = path.join(path.dirname(target), `.dockge-upload-backup-${randomUUID()}.tmp`);
        await fsAsync.rename(target, backup);
        try {
            await fsAsync.rename(temporary, target);
            await fsAsync.rm(backup, { force: true });
        } catch (error) {
            await fsAsync.rm(target, { force: true }).catch(() => {});
            await fsAsync.rename(backup, target).catch(() => {});
            throw error;
        }
    }

    private hash(buffer : Uint8Array) {
        return createHash("sha256").update(buffer).digest("hex");
    }

    private fileId(stat : fs.Stats) {
        return `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
    }

    private async readUtf8Chunk(handle : FileHandle, requestedOffset : number, size : number) {
        if (requestedOffset >= size) {
            return { content: "",
                offset: size,
                nextOffset: size };
        }

        const length = Math.min(FILE_MANAGER_CHUNK_SIZE, size - requestedOffset);
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, requestedOffset);
        if (bytesRead === 0) {
            throw new FileManagerError("TRANSFER_CHANGED", "The file changed while it was being read.");
        }

        const bytes = buffer.subarray(0, bytesRead);
        const reachedEnd = requestedOffset + bytesRead >= size;
        const maxLeadingTrim = Math.min(3, bytes.length - 1);
        const maxTrailingTrim = reachedEnd ? 0 : Math.min(3, bytes.length - 1);
        for (let leadingTrim = 0; leadingTrim <= maxLeadingTrim; leadingTrim++) {
            for (let trailingTrim = 0; trailingTrim <= maxTrailingTrim; trailingTrim++) {
                const end = bytes.length - trailingTrim;
                if (end <= leadingTrim) {
                    continue;
                }
                const candidate = bytes.subarray(leadingTrim, end);
                try {
                    const content = new TextDecoder("utf-8", { fatal: true }).decode(candidate);
                    if (hasBinaryBytes(candidate)) {
                        throw new FileManagerError("NOT_TEXT", "Binary files cannot be viewed as text.");
                    }
                    const offset = requestedOffset + leadingTrim;
                    return { content,
                        offset,
                        nextOffset: offset + candidate.byteLength };
                } catch (error) {
                    if (error instanceof FileManagerError) {
                        throw error;
                    }
                }
            }
        }
        throw new FileManagerError("NOT_UTF8", "Only UTF-8 text files can be viewed.");
    }
}

function hasBinaryBytes(buffer : Buffer) {
    if (buffer.includes(0)) {
        return true;
    }

    let controlBytes = 0;
    for (const byte of buffer) {
        if ((byte < 32 && byte !== 8 && byte !== 9 && byte !== 10 && byte !== 12 && byte !== 13) || byte === 127) {
            controlBytes++;
        }
    }
    return controlBytes > Math.max(1, Math.floor(buffer.byteLength * 0.01));
}
