const API = process.env.API_ORIGIN || 'http://localhost:4100';
export default {
  transpilePackages: ['@smart/shared'],
  compress: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  async rewrites() { return [{ source: '/api/v1/:path*', destination: `${API}/api/v1/:path*` }]; },
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'X-Frame-Options', value: 'DENY' }, { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'same-origin' } ] }]; },
};
