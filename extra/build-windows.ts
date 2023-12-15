import fsAsync from "fs/promises";
import unzipper from "unzipper";
import stream from "node:stream";
import { fileExists } from "../backend/util-server";

const version = process.env.VERSION;

if (!version) {
    console.error("VERSION env not set");
    process.exit(1);
}

const output = `./private/build/dockgen-${version}-win-x64.zip`;

if (await fileExists(output)) {
    console.error(`${output} already exists`);
    process.exit(1);
}

console.log(`Building ${output}`);

const nodeVersion = "18.17.1";
const buildPath = "./private/build/windows";
const nodePath = `${buildPath}/node`;
const nodeTempPath = `${buildPath}/node-v${nodeVersion}-win-x64`;
const corePath = `${buildPath}/core`;

// Clear
await fsAsync.rm(`${buildPath}/dockge-${version}`, {
    recursive: true,
    force: true
});

await fsAsync.rm(corePath, {
    recursive: true,
    force: true
});

// mkdir
await fsAsync.mkdir(buildPath, {
    recursive: true
});

// Download Node.js if not exists
// Download,pipe to unzipper and extract to nodePath
if (!await fileExists(nodePath)) {
    console.log(`Downloading Node.js ${nodeVersion}`);

    try {
        await download(`https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-win-x64.zip`);
        // Rename folder
        await fsAsync.rename(nodeTempPath, nodePath);
    } catch (e) {
        if (e instanceof Error) {
            console.error(e.message);
        }
        process.exit(1);
    }
} else {
    console.log(`Node.js ${nodeVersion} already exists, skipping download`);
}

// Download Dockge from GitHub
console.log(`Downloading Dockge ${version} from GitHub`);

try {
    await download(`https://github.com/louislam/dockge/archive/refs/tags/${version}.zip`);
    // Rename folder
    await fsAsync.rename(`${buildPath}/dockge-${version}`, corePath);
} catch (e) {
    if (e instanceof Error) {
        console.error(e.message);
    }
    process.exit(1);
}

function download(url : string) {
    return new Promise((resolve, reject) => {
        fetch(url).then((res) => {
            if (res.body) {
                // @ts-ignore
                stream.Readable.fromWeb(res.body)
                    .pipe(unzipper.Extract({
                        path: buildPath,
                    }))
                    .on("close", resolve);
            } else {
                reject(new Error(`Unable to download ${url}`));
            }
        });
    });
}
