import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8002";

const nextConfig: NextConfig = {
  // Proxy /api/* to Django so the browser only talks to this origin and the
  // auth cookies are first-party. Django expects trailing slashes; the
  // frontend calls paths without them and the rewrite adds the slash.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*/`,
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
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
