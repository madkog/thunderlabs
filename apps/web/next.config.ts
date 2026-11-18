import type { NextConfig } from "next";

// Where the API runs. The browser only talks to this app, and /api/* is
// forwarded to the API, so requests are same-origin and need no CORS.
const apiUrl = process.env.API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  // Tailwind CSS v4 runs as a Turbopack loader. Without it, the @imports in
  // globals.css (tailwindcss, tw-animate-css, shadcn) can't be resolved.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
