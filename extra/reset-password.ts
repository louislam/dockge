import { Database } from "../backend/database";
import { R } from "redbean-node";
import readline from "readline";
import { User } from "../backend/models/user";
import { DockgeServer } from "../backend/dockge-server";
import { log } from "../backend/log";

console.log("== Dockge Reset Password Tool ==");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

export const main = async () => {
    const server = new DockgeServer();

    // Check if

    console.log("Connecting the database");
    try {
        await Database.init(server);
    } catch (e) {
        if (e instanceof Error) {
            log.error("server", "Failed to connect to your database: " + e.message);
        }
        process.exit(1);
    }

    try {
        // No need to actually reset the password for testing, just make sure no connection problem. It is ok for now.
        if (!process.env.TEST_BACKEND) {
            const user = await R.findOne("user");
            if (! user) {
                throw new Error("user not found, have you installed?");
            }

            console.log("Found user: " + user.username);

            while (true) {
                let password = await question("New Password: ");
                let confirmPassword = await question("Confirm New Password: ");

                if (password === confirmPassword) {
                    await User.resetPassword(user.id, password);

                    // Reset all sessions by reset jwt secret
                    await server.initJWTSecret();

                    break;
                } else {
                    console.log("Passwords do not match, please try again.");
                }
            }
            console.log("Password reset successfully.");
        }
    } catch (e) {
        if (e instanceof Error) {
            console.error("Error: " + e.message);
        }
    }

    await Database.close();
    rl.close();

    console.log("Finished.");
};

/**
 * Ask question of user
 * @param question Question to ask
 * @returns Users response
 */
function question(question : string) : Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

if (!process.env.TEST_BACKEND) {
    main();
}
