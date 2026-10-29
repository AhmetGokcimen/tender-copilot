import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
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
