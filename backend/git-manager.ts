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
            const git: SimpleGit = simpleGit(stackPath);
            const status: StatusResult = await git.status();
            
            const files = [
                ...status.modified.map(file => ({ path: file, status: "modified", staged: false })),
                ...status.not_added.map(file => ({ path: file, status: "untracked", staged: false })),
                ...status.created.map(file => ({ path: file, status: "new file", staged: true })),
                ...status.deleted.map(file => ({ path: file, status: "deleted", staged: false })),
                ...status.renamed.map(file => ({ path: file.to, status: "renamed", staged: true })),
                ...status.staged.map(file => ({ path: file, status: "staged", staged: true })),
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
            const git: SimpleGit = simpleGit(stackPath);
            await git.add(files);
        } catch (error) {
            log.error("git-manager", `Error adding files: ${error}`);
            throw error;
        }
    }

    /**
     * Commit changes
     */
    static async commit(stackPath: string, message: string): Promise<void> {
        try {
            const git: SimpleGit = simpleGit(stackPath);
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
        try {
            const git: SimpleGit = simpleGit(stackPath);
            
            if (credentials) {
                // Configure git credentials
                await this.configureCredentials(stackPath, credentials);
            }
            
            await git.push();
        } catch (error) {
            log.error("git-manager", `Error pushing changes: ${error}`);
            throw error;
        }
    }

    /**
     * Pull changes from remote repository
     */
    static async pull(stackPath: string, credentials?: GitCredentials): Promise<void> {
        try {
            const git: SimpleGit = simpleGit(stackPath);
            
            if (credentials) {
                // Configure git credentials
                await this.configureCredentials(stackPath, credentials);
            }
            
            await git.pull();
        } catch (error) {
            log.error("git-manager", `Error pulling changes: ${error}`);
            throw error;
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

        // Parse the URL and inject credentials
        const url = new URL(remoteUrl);
        url.username = encodeURIComponent(credentials.username);
        url.password = encodeURIComponent(credentials.password);
        
        // Set the remote URL with credentials
        await git.remote(["set-url", "origin", url.toString()]);
    }

    /**
     * Save git credentials to settings
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
            return { username, password };
        }
        
        return null;
    }

    /**
     * Check if a directory is a git repository
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
}
