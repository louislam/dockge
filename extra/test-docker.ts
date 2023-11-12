// Check if docker is running
import { exec } from "child_process";

exec("docker ps", (err, stdout, stderr) => {
    if (err) {
        console.error("Docker is not running. Please start docker and try again.");
        process.exit(1);
    }
});
