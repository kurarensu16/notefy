import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: [".trycloudflare.com", ".cfargotunnel.com"],
  },
  preview: {
    host: true,
    allowedHosts: [".trycloudflare.com", ".cfargotunnel.com"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-editor";
          if (id.includes("convex")) return "vendor-convex";
          if (id.includes("qrcode")) return "vendor-qrcode";
          if (id.includes("@phosphor-icons")) return "vendor-icons";
          if (id.includes("react-router") || id.includes("react-dom") || id.includes("/react/")) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
