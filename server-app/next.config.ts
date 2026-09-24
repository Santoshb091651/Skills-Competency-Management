import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output keeps the production image small (see Dockerfile).
  output: 'standalone',
  typedRoutes: false,
  // ExcelJS is CommonJS and must not be bundled into the server build.
  serverExternalPackages: ['exceljs'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
