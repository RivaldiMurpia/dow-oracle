import type { NextConfig } from "next";

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
    return config;
  },
};

export default nextConfig;
