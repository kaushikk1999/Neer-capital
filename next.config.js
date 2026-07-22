/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: [] },
  experimental: { instrumentationHook: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Railway serves every custom domain directly, so the apex answered as a
  // second live copy of the site rather than deferring to www. That splits
  // search ranking across two hosts, and a session cookie set on one is not
  // sent to the other, so signing in on the apex looked like being signed out
  // on www. Only the bare apex is redirected: the Railway hostname stays
  // reachable as it is, and rewriting it would break admin access if the
  // custom domain ever fails.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'neercapital.com' }],
        destination: 'https://www.neercapital.com/:path*',
        permanent: true,
      },
    ];
  },
};

// Optional bundle analysis: `ANALYZE=true npm run build` (dev-only tooling).
module.exports =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })(nextConfig)
    : nextConfig;
