import { simpleGit, SimpleGit, StatusResult } from "simple-git";
import { Settings } from "./settings";
import { log } from "./log";

export interface GitCredentials {
    username: string;
    password: string;
}

export interface GitStatusResponse {
    files: {
        path: string;
        status: string;
        staged: boolean;
    }[];
    current: string;
    tracking: string | null;
    ahead: number;
    behind: number;
}

export class GitManager {

    /**
     * Get git status for a stack directory
     */
    static async getStatus(stackPath: string): Promise<GitStatusResponse> {
        try {
            // Find git root to ensure we're working from the repository root
            const gitRoot = await this.getGitRoot(stackPath);
            const git: SimpleGit = simpleGit(gitRoot);
            const status: StatusResult = await git.status();

            // Create a set of all staged file paths to exclude them from unstaged lists
            const stagedFilePaths = new Set([
                ...status.staged,
                ...status.created,
                ...status.renamed.map(file => file.to),
            ]);

            const files = [
                // Only include modified files that are NOT staged
                ...status.modified
                    .filter(file => !stagedFilePaths.has(file))
                    .map(file => ({ path: file,
                        status: "modified",
                        staged: false })),
                // Only include untracked files that are NOT staged
                ...status.not_added
                    .filter(file => !stagedFilePaths.has(file))
                    .map(file => ({ path: file,
                        status: "untracked",
                        staged: false })),
                // Only include deleted files that are NOT staged
                ...status.deleted
                    .filter(file => !stagedFilePaths.has(file))
                    .map(file => ({ path: file,
                        status: "deleted",
                        staged: false })),
                // Staged files (created, renamed, and explicitly staged)
                ...status.created.map(file => ({ path: file,
                    status: "new file",
                    staged: true })),
                ...status.renamed.map(file => ({ path: file.to,
                    status: "renamed",
                    staged: true })),
                ...status.staged.map(file => ({ path: file,
                    status: "staged",
                    staged: true })),
            ];

            return {
                files,
                current: status.current || "unknown",
                tracking: status.tracking || null,
                ahead: status.ahead,
                behind: status.behind,
            };
        } catch (error) {
            log.error("git-manager", `Error getting git status: ${error}`);
            throw error;
        }
    }

    /**
     * Add files to git staging area
     */
    static async addFiles(stackPath: string, files: string[]): Promise<void> {
        try {
            // Find git root to ensure we're working from the repository root
            const gitRoot = await this.getGitRoot(stackPath);
            const git: SimpleGit = simpleGit(gitRoot);
            await git.add(files);
        } catch (error) {
            log.error("git-manager", `Error adding files: ${error}`);
            throw error;
        }
    }

    /**
     * Remove files from git staging area (unstage)
     */
    static async unstageFiles(stackPath: string, files: string[]): Promise<void> {
        try {
            // Find git root to ensure we're working from the repository root
            const gitRoot = await this.getGitRoot(stackPath);
            const git: SimpleGit = simpleGit(gitRoot);
            await git.reset([ "--", ...files ]);
        } catch (error) {
            log.error("git-manager", `Error unstaging files: ${error}`);
            throw error;
        }
    }

    /**
     * Commit changes
     */
    static async commit(stackPath: string, message: string): Promise<void> {
        try {
            // Find git root to ensure we're working from the repository root
            const gitRoot = await this.getGitRoot(stackPath);
            const git: SimpleGit = simpleGit(gitRoot);
            await git.commit(message);
        } catch (error) {
            log.error("git-manager", `Error committing changes: ${error}`);
            throw error;
        }
    }

    /**
     * Push changes to remote repository
     */
    static async push(stackPath: string, credentials?: GitCredentials): Promise<void> {
        // Find git root to ensure we're working from the repository root
        const gitRoot = await this.getGitRoot(stackPath);
        const git: SimpleGit = simpleGit(gitRoot);
        let originalRemoteUrl: string | null = null;

        try {
            if (credentials) {
                // Store original URL before modifying
                const remotes = await git.getRemotes(true);
                if (remotes.length > 0) {
                    originalRemoteUrl = remotes[0].refs.push || remotes[0].refs.fetch;
                }
                // Configure git credentials
                await this.configureCredentials(gitRoot, credentials);
            }

            await git.push();
        } catch (error) {
            log.error("git-manager", `Error pushing changes: ${error}`);
            throw error;
        } finally {
            // Restore original remote URL if it was modified
            if (originalRemoteUrl && credentials) {
                try {
                    await git.remote([ "set-url", "origin", originalRemoteUrl ]);
                } catch (e) {
                    log.warn("git-manager", `Could not restore original remote URL: ${e}`);
                }
            }
        }
    }

    /**
     * Pull changes from remote repository
     */
    static async pull(stackPath: string, credentials?: GitCredentials): Promise<void> {
        // Find git root to ensure we're working from the repository root
        const gitRoot = await this.getGitRoot(stackPath);
        const git: SimpleGit = simpleGit(gitRoot);
        let originalRemoteUrl: string | null = null;

        try {
            if (credentials) {
                // Store original URL before modifying
                const remotes = await git.getRemotes(true);
                if (remotes.length > 0) {
                    originalRemoteUrl = remotes[0].refs.push || remotes[0].refs.fetch;
                }
                // Configure git credentials
                await this.configureCredentials(gitRoot, credentials);
            }

            await git.pull();
        } catch (error) {
            log.error("git-manager", `Error pulling changes: ${error}`);
            throw error;
        } finally {
            // Restore original remote URL if it was modified
            if (originalRemoteUrl && credentials) {
                try {
                    await git.remote([ "set-url", "origin", originalRemoteUrl ]);
                } catch (e) {
                    log.warn("git-manager", `Could not restore original remote URL: ${e}`);
                }
            }
        }
    }

    /**
     * Configure git credentials using credential helper
     */
    private static async configureCredentials(stackPath: string, credentials: GitCredentials): Promise<void> {
        const git: SimpleGit = simpleGit(stackPath);

        // Get the remote URL
        const remotes = await git.getRemotes(true);
        if (remotes.length === 0) {
            throw new Error("No remote repository configured");
        }

        const remote = remotes[0];
        const remoteUrl = remote.refs.push || remote.refs.fetch;

        if (!remoteUrl) {
            throw new Error("No remote URL found");
        }

        // Only handle HTTPS URLs, skip SSH URLs
        if (!remoteUrl.startsWith("http://") && !remoteUrl.startsWith("https://")) {
            log.warn("git-manager", "SSH URLs are not supported for credential injection. Please configure SSH keys separately.");
            return;
        }

        try {
            // Parse the URL and inject credentials
            const url = new URL(remoteUrl);
            url.username = encodeURIComponent(credentials.username);
            url.password = encodeURIComponent(credentials.password);

            // Set the remote URL with credentials temporarily (for this operation only)
            await git.remote([ "set-url", "origin", url.toString() ]);
        } catch (error) {
            log.error("git-manager", `Error configuring credentials: ${error}`);
            throw new Error("Failed to configure git credentials. Please check the remote URL format.");
        }
    }

    /**
     * Save git credentials to settings
     * WARNING: Credentials are stored in plain text in the database.
     * For production use, consider implementing encryption or using
     * a more secure credential storage mechanism.
     */
    static async saveCredentials(credentials: GitCredentials): Promise<void> {
        await Settings.set("gitUsername", credentials.username, "git");
        await Settings.set("gitPassword", credentials.password, "git");
    }

    /**
     * Get stored git credentials
     */
    static async getCredentials(): Promise<GitCredentials | null> {
        const username = await Settings.get("gitUsername");
        const password = await Settings.get("gitPassword");

        if (username && password) {
            return { username,
                password };
        }

        return null;
    }

    /**
     * Get the git root directory for a given path
     * @param stackPath The path to search from
     * @returns The absolute path to the git root directory
     */
    private static async getGitRoot(stackPath: string): Promise<string> {
        try {
            const git: SimpleGit = simpleGit(stackPath);
            const result = await git.revparse([ "--show-toplevel" ]);
            return result.trim();
        } catch (error) {
            log.error("git-manager", `Error finding git root from ${stackPath}: ${error}`);
            throw new Error(`Unable to find git repository root. The path '${stackPath}' may not be inside a git repository.`);
        }
    }

    /**
     * Check if a directory is a git repository
     * This checks if the given path is within a git repository,
     * not necessarily the git root itself.
     */
    static async isGitRepository(stackPath: string): Promise<boolean> {
        try {
            const git: SimpleGit = simpleGit(stackPath);
            await git.status();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clone a remote git repository
     * @param repoUrl The URL of the repository to clone
     * @param targetPath The directory path where the repository should be cloned
     * @param credentials Optional credentials for private repositories
     */
    static async clone(repoUrl: string, targetPath: string, credentials?: GitCredentials): Promise<void> {
        try {
            let cloneUrl = repoUrl;

            // If credentials provided and URL is HTTPS, inject them
            if (credentials && (repoUrl.startsWith("http://") || repoUrl.startsWith("https://"))) {
                const url = new URL(repoUrl);
                url.username = encodeURIComponent(credentials.username);
                url.password = encodeURIComponent(credentials.password);
                cloneUrl = url.toString();
            }

            const git: SimpleGit = simpleGit();
            await git.clone(cloneUrl, targetPath);

            // If credentials were used, remove them from the remote URL after cloning
            if (credentials && (repoUrl.startsWith("http://") || repoUrl.startsWith("https://"))) {
                const clonedGit: SimpleGit = simpleGit(targetPath);
                await clonedGit.remote([ "set-url", "origin", repoUrl ]);
            }

            log.info("git-manager", `Repository cloned successfully to ${targetPath}`);
        } catch (error) {
            log.error("git-manager", `Error cloning repository: ${error}`);
            throw error;
        }
    }
}
