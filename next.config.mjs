import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Baseline browser protections on every response. A full
        // Content-Security-Policy is left out on purpose: the site loads
        // Google Analytics and fonts, and a policy needs testing against
        // them first. `frame-ancestors` alone stops other sites framing us.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
      {
        // The signed-in product and auth screens are never indexed.
        source: '/:locale(en|ro)/:area(app|auth|onboarding)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  async rewrites() {
    // Local two-process dev only: proxy /api to the separately running
    // uvicorn backend so relative fetch('/api/...') works in dev exactly
    // like in production. Never runs in production — Vercel routes /api
    // to the Python function via vercel.json instead.
    if (process.env.NODE_ENV === 'development') {
      return [{ source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }];
    }
    return [];
  },
};

export default withNextIntl(nextConfig);
