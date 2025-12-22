import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Зменшуємо кількість воркерів у dev для економії пам'яті
    hmr: {
      overlay: true,
    },
  },
  build: {
    // Вимикаємо source maps у production для зменшення розміру
    sourcemap: false,
    // Мінімізуємо розмір
    minify: "esbuild",
    // Агресивне tree-shaking
    rollupOptions: {
      output: {
        // Ручне розділення чанків для оптимізації кешування
        manualChunks: (id) => {
          // Monaco Editor - окремий чанк (дуже великий)
          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) {
            return "monaco";
          }
          // React та React DOM - окремий чанк
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
            return "react-vendor";
          }
          // Markdown та Math - окремий чанк
          if (
            id.includes("react-markdown") ||
            id.includes("remark") ||
            id.includes("rehype") ||
            id.includes("katex")
          ) {
            return "markdown";
          }
          // Syntax highlighter - окремий чанк
          if (id.includes("react-syntax-highlighter") || id.includes("prismjs")) {
            return "syntax";
          }
          // Інші vendor бібліотеки
          if (id.includes("node_modules")) {
            if (id.includes("axios") || id.includes("lucide-react")) {
              return "utils";
            }
            return "vendor";
          }
        },
        // Оптимізація імен файлів
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
      // Tree-shaking для невикористаних експортів
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
    },
    // Збільшуємо chunk size warning limit (Monaco великий)
    chunkSizeWarningLimit: 1000,
    // Оптимізація для production
    target: "esnext",
    cssCodeSplit: true,
  },
  // Оптимізація для dev
  optimizeDeps: {
    // Виключаємо Monaco з pre-bundling (завантажуємо тільки коли потрібен)
    exclude: ["@monaco-editor/react", "monaco-editor"],
    // Включаємо тільки необхідні залежності
    include: ["react", "react-dom", "react-router-dom"],
  },
});
