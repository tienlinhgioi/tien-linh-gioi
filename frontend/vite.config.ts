import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const artDirectory = fileURLToPath(new URL("./public/art/", import.meta.url));
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  define: {
    __ART_FILES__: JSON.stringify(
      existsSync(artDirectory) ? readdirSync(artDirectory) : [],
    ),
  },
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: "refresh-optional-art",
      configureServer(server) {
        server.watcher.add(artDirectory);
        for (const event of ["add", "unlink"] as const)
          server.watcher.on(event, (file) => {
            if (file.startsWith(artDirectory)) void server.restart();
          });
      },
    },
  ],
});
