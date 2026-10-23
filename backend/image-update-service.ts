import childProcessAsync from "promisify-child-process";
import { Stack } from "./stack";
import { log } from "./log";

export interface ServiceUpdateData {
    name: string;
    containerName: string;
    image: string;
    imageVersion: string | null;
    state: string;
    status: string;
    health: string;
    imageUpdateAvailable: boolean;
    localImageDigest: string | null;
    remoteImageDigest: string | null;
}

type ComposeService = {
    Service?: string;
    Name?: string;
    Image?: string;
    State?: string;
    Status?: string;
    Health?: string;
};

export class ImageUpdateService {
    private static cache = new Map<string, Record<string, ServiceUpdateData>>();

    static getCached(stackName: string): Record<string, ServiceUpdateData> | undefined {
        return this.cache.get(stackName);
    }

    static async getServices(stack: Stack, checkRemote = false): Promise<Record<string, ServiceUpdateData>> {
        const composeServices = this.normalize(await stack.ps());
        const previous = this.cache.get(stack.name) ?? {};
        const services: Record<string, ServiceUpdateData> = {};

        for (const service of composeServices) {
            const name = service.Service ?? service.Name;
            if (!name) {
                continue;
            }
            const image = service.Image ?? "";
            const local = await this.inspectLocalImage(image);
            const remoteDigest = checkRemote
                ? await this.inspectRemoteDigest(image)
                : previous[name]?.remoteImageDigest ?? null;

            services[name] = {
                name,
                containerName: service.Name ?? name,
                image,
                imageVersion: local.version,
                state: service.State ?? "unknown",
                status: service.Status ?? "",
                health: service.Health ?? "",
                imageUpdateAvailable: !!(
                    local.digest &&
                    remoteDigest &&
                    local.digest !== remoteDigest
                ),
                localImageDigest: local.digest,
                remoteImageDigest: remoteDigest,
            };
        }

        this.cache.set(stack.name, services);
        return services;
    }

    static hasUpdates(stackName: string): boolean {
        return Object.values(this.cache.get(stackName) ?? {})
            .some((service) => service.imageUpdateAvailable);
    }

    private static normalize(data: object): ComposeService[] {
        if (Array.isArray(data)) {
            return data;
        }
        return Object.keys(data).length ? [ data as ComposeService ] : [];
    }

    private static async inspectLocalImage(image: string): Promise<{
        digest: string | null;
        version: string | null;
    }> {
        if (!image) {
            return {
                digest: null,
                version: null,
            };
        }

        try {
            const result = await childProcessAsync.spawn(
                "docker",
                [ "image", "inspect", "--format", "json", image ],
                { encoding: "utf-8" }
            );
            const data = JSON.parse(result.stdout?.toString() ?? "[]");
            const info = Array.isArray(data) ? data[0] : null;
            const repoDigest = Array.isArray(info?.RepoDigests) ? info.RepoDigests[0] : null;
            return {
                digest: typeof repoDigest === "string" ? repoDigest.split("@")[1] ?? null : null,
                version: info?.Config?.Labels?.["org.opencontainers.image.version"] ?? null,
            };
        } catch (e) {
            log.debug("image-update", `Failed to inspect local image ${image}: ${e}`);
            return {
                digest: null,
                version: null,
            };
        }
    }

    private static async inspectRemoteDigest(image: string): Promise<string | null> {
        if (!image || image.startsWith("sha256:")) {
            return null;
        }

        try {
            const result = await childProcessAsync.spawn(
                "skopeo",
                [ "inspect", "--no-tags", "--format", "{{ .Digest }}", `docker://${image}` ],
                { encoding: "utf-8" }
            );
            return result.stdout?.toString().trim() || null;
        } catch (e) {
            log.warn("image-update", `Failed to inspect remote image ${image}: ${e}`);
            return null;
        }
    }
}
