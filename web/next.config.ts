import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // The shared pipeline in ../src is a NodeNext ESM TypeScript project:
    // its files import siblings with `.js` specifiers (`./prompts.js` for
    // `./prompts.ts`). Webpack needs an explicit extension alias to resolve
    // those when the API route imports the pipeline.
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    // Pipeline files live outside web/, so their bare imports (zod, openai)
    // can't reach web/node_modules by walking up the tree. Add it explicitly —
    // deployment only installs web/ dependencies.
    const webModules = path.resolve(process.cwd(), "node_modules");
    const existing = (config.resolve.modules as string[] | undefined) ?? ["node_modules"];
    config.resolve.modules = [webModules, ...existing.filter((m) => m !== webModules)];
    return config;
  },
};

export default nextConfig;
