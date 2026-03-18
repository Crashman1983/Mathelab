import { defineConfig, type UserConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

/** Shared config used by both single-file and PWA builds */
export const sharedConfig: UserConfig = {
  resolve: {
    alias: {
      "@app": resolve(__dirname, "src/app"),
      "@core": resolve(__dirname, "src/core"),
      "@ui": resolve(__dirname, "src/ui"),
      "@canvas": resolve(__dirname, "src/canvas"),
      "@modules": resolve(__dirname, "src/modules"),
      "@styles": resolve(__dirname, "src/styles"),
      "@data": resolve(__dirname, "src/data"),
      "@test": resolve(__dirname, "src/test"),
    },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/tests/setup-canvas-mock.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      include: [
        "src/**/logic.ts",
        "src/**/math3d.ts",
        "src/core/**/*.ts",
        "src/canvas/**/*.ts",
        "src/app/**/*.ts",
        "src/ui/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/test/**",
        "src/tests/**",
        "src/canvas/illustrations/**",
        "src/canvas/celebration.ts",
        "src/canvas/animations/**",
        "src/canvas/nodes/index.ts",
        "src/core/types.ts",
        "src/canvas/interactions/index.ts",
        "src/app/shell.ts",
        "src/app/module-framework.ts",
        "src/ui/overlay.ts",
        "src/canvas/tracked-context.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
};

// Default: Single-file build (alles in eine HTML-Datei)
export default defineConfig({
  ...sharedConfig,
  plugins: [
    viteSingleFile({
      removeViteModuleLoader: true,
      useRecommendedBuildConfig: true,
    }),
  ],
  build: {
    ...sharedConfig.build,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      ...sharedConfig.build?.rollupOptions,
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
});
