import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({plugins:[react()],root:path.resolve("preview"),base:"./",resolve:{alias:{"@":path.resolve("client/src"),"@shared":path.resolve("shared")}},build:{outDir:path.resolve("preview-dist"),emptyOutDir:true}});
