import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { BootstrapVueNextResolver } from "unplugin-vue-components/resolvers";
import viteCompression from "vite-plugin-compression";
import "vue";
import "dotenv/config";

const viteCompressionFilter = /\.(js|mjs|json|css|html|svg)$/i;

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
    return {
        /* For `build`, set `base` to a relative path to allow for runtime configuration. For `serve`, set the value of
        `DOCKGE_BASE_PATH` or its default of `/` if none was given. */
        base: command === "build" ? "./" : (process.env.DOCKGE_BASE_PATH?.concat("/") || "/"),
        server: {
            port: 5000,
        },
        define: {
            "FRONTEND_VERSION": JSON.stringify(process.env.npm_package_version),
        },
        root: "./frontend",
        build: {
            outDir: "../frontend-dist",
        },
        plugins: [
            vue({
                /* Extend the list of asset tags for base path handling to include object tags, which are used to link
                SVG icons. */
                template: {
                    transformAssetUrls: {
                        img: [ "src" ],
                        object: [ "data" ],
                    }
                }
            }),
            Components({
                resolvers: [ BootstrapVueNextResolver() ],
            }),
            viteCompression({
                algorithm: "gzip",
                filter: viteCompressionFilter,
            }),
            viteCompression({
                algorithm: "brotliCompress",
                filter: viteCompressionFilter,
            }),
        ],
    };
});
