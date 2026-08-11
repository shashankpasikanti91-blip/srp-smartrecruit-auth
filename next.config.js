/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // File uploads (PDF/DOCX): raise Next 16 proxy body buffer so CVs are not truncated
  // into HTML error pages that screening then fails to JSON.parse.
  experimental: {
    proxyClientMaxBodySize: '25mb',
  },
  // Force standalone output to bundle these runtime-require()'d packages
  outputFileTracingIncludes: {
    '/api/parse': [
      './node_modules/pdf-parse/**/*',
      './node_modules/mammoth/**/*',
      './node_modules/node-ensure/**/*',
      './node_modules/word-extractor/**/*',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https: wss:",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
