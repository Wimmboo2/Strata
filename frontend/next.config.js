/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "https://strata-backend-3eqx.onrender.com";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/:path*`
      }
    ];
  },
  async headers() {
    return [
      {
        // Sync responses are per-user and change constantly. Vercel caches
        // external-rewrite responses by default, so opt this path out
        // explicitly: a cached /sync/status would report a stale job state.
        source: "/api/backend/:path*",
        headers: [
          { key: "x-vercel-enable-rewrite-caching", value: "0" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
