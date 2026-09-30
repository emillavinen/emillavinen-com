import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-inline needed for JSON-LD scripts; plausible.io serves the analytics script
      "script-src 'self' 'unsafe-inline' https://plausible.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self'",
      "frame-src https://open.spotify.com https://www.youtube-nocookie.com https://player.vimeo.com",
      // plausible.io receives analytics events; vercel.com and the Blob
      // store take the drop page's direct browser uploads (@vercel/blob/client)
      "connect-src 'self' https://api.github.com https://plausible.io https://vercel.com https://*.blob.vercel-storage.com",
      "font-src 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control",    value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
