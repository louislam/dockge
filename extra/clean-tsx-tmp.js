/*
 * This script is used to clean up the tmp directory.
 * A workaround for https://github.com/louislam/dockge/issues/353
 */
import * as fs from "fs";

try {
    fs.rmSync("/tmp/tsx-0", {
        recursive: true,
    });
} catch (e) {

}
