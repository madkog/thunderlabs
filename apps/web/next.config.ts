import type { NextConfig } from "next";

// Where the API runs. The browser only talks to this app, and /api/* is
// forwarded to the API, so requests are same-origin and need no CORS.
const apiUrl = process.env.API_URL ?? "http://localhost:3001";

// Security headers for every page. The API sets its own (helmet).
const securityHeaders = [
  // Stop other sites framing the store, so nobody can trick a click on "Buy now" (clickjacking).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" }, // the same, for older browsers
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
