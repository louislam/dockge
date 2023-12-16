import fs from "fs";

async function main() {
    // TARGETPLATFORM
    const targetPlatform = process.argv[2];

    // Docker Compose version
    const dockerComposeVersion = process.argv[3];

    // Arch
    let arch = "";

    if (targetPlatform === "linux/amd64") {
        arch = "x86_64";
    } else if (targetPlatform === "linux/arm64") {
        arch = "aarch64";
    } else if (targetPlatform === "linux/arm/v7") {
        arch = "armv7";
    } else {
        throw new Error(`Unknown target platform: ${targetPlatform}`);
    }

    // mkdir -p /root/.docker/cli-plugins
    fs.mkdirSync("/root/.docker/cli-plugins", { recursive: true });

    // Download URL
    const url = `https://github.com/docker/compose/releases/download/v${dockerComposeVersion}/docker-compose-linux-${arch}`;

    console.log(url);

    // Download docker-compose using fetch api, to "/root/.docker/cli-plugins/docker-compose"
    const buffer = await (await fetch(url)).arrayBuffer();
    fs.writeFileSync("/root/.docker/cli-plugins/docker-compose", Buffer.from(buffer));

    // chmod +x /root/.docker/cli-plugins/docker-compose
    fs.chmodSync("/root/.docker/cli-plugins/docker-compose", 0o111);
}

main();
