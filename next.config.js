/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Force standalone output to bundle these runtime-require()'d packages
  outputFileTracingIncludes: {
    '/api/parse': [
      './node_modules/pdf-parse/**/*',
      './node_modules/mammoth/**/*',
      './node_modules/node-ensure/**/*',
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
}

module.exports = nextConfig
