import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "linkedom", "@mozilla/readability", "pg"],
  outputFileTracingIncludes: {
    "/api/versions/*/pdf": ["./src/assets/fonts/*"],
    "/s/*/pdf": ["./src/assets/fonts/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
