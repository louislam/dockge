import { Database } from "../backend/database";
import { R } from "redbean-node";
import readline from "readline";
import { User } from "../backend/models/user";
import { DockgeServer } from "../backend/dockge-server";
import { log } from "../backend/log";
import { io } from "socket.io-client";
import { BaseRes } from "../common/util-common";
import { generatePasswordHash } from "../backend/password-hash";

console.log("== Dockge Reset Password Tool ==");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const server = new DockgeServer();

export const main = async () => {
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
        let user ;
        // No need to actually reset the password for testing, just make sure no connection problem. It is ok for now.

        if (!process.env.TEST_BACKEND) {
            user = await R.findOne("user");

            if (! user ) {
                if ( !process.env.USER ) {
                    throw new Error("user not found or provided, have you installed? Try to set USER and PASSWORD variables ...");
                } else {
                    console.log("Trying to initialise user : " + process.env.USER);
                    user = R.dispense("user");
                    user.username = process.env.USER;
                    user.password = generatePasswordHash(process.env.PASSWORD);
                    await R.store(user);
                    console.log("User/Password set successfully");

                    // Reset all sessions by reset jwt secret
                    await server.initJWTSecret();
                    console.log("JWT reset successfully.");

                    // Disconnect all other socket clients of the user
                    await disconnectAllSocketClients(user.username, user.password);
                    console.log("You may have to restart");
                    exit;
                }
            }
        }

        let password = "";
        let confirmPassword = " ";

        while (true) {

            if (process.env.PASSWORD) {
                console.log("Found password : " + process.env.PASSWORD) ;
                password = process.env.PASSWORD ;
                confirmPassword = process.env.PASSWORD ;
            } else {
                console.log("No found password: " ) ;
                password = await question("New Password: ");
                confirmPassword = await question("Confirm New Password: ");
            }

            if (password === confirmPassword) {
                await User.resetPassword(user.id, password);
                console.log("Password reset successfully.");

                // Reset all sessions by reset jwt secret
                await server.initJWTSecret();

                console.log("JWT reset successfully.");

                // Disconnect all other socket clients of the user
                await disconnectAllSocketClients(user.username, password);

            } else {
                console.log("Passwords do not match, please try again.");
                break;
            }
            break;
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

function disconnectAllSocketClients(username : string, password : string) : Promise<void> {
    return new Promise((resolve) => {
        const url = server.getLocalWebSocketURL();

        console.log("Connecting to " + url + " to disconnect all other socket clients");

        // Disconnect all socket connections
        const socket = io(url, {
            reconnection: false,
            timeout: 5000,
        });
        socket.on("connect", () => {
            socket.emit("login", {
                username,
                password,
            }, (res : BaseRes) => {
                if (res.ok) {
                    console.log("Logged in.");
                    socket.emit("disconnectOtherSocketClients");
                } else {
                    console.warn("Login failed.");
                    console.warn("Please restart the server to disconnect all sessions.");
                }
                socket.close();
            });
        });

        socket.on("connect_error", function () {
            // The localWebSocketURL is not guaranteed to be working for some complicated Uptime Kuma setup
            // Ask the user to restart the server manually
            console.warn("Failed to connect to " + url);
            console.warn("Please restart the server to disconnect all sessions manually.");
            resolve();
        });
        socket.on("disconnect", () => {
            resolve();
        });
    });
}

if (!process.env.TEST_BACKEND) {
    main();
}

