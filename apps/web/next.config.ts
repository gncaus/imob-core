import type { NextConfig } from 'next';

// O painel conversa com a API pelo próprio domínio (/api/*): o cookie de sessão fica first-party.
const apiUrl = (process.env.API_URL ?? 'http://localhost:3333').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@imob/shared'],
  rewrites: () => Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/:path*` }]),
  images: {
    // Fotos servidas pelo storage (MinIO local); em produção, o domínio público das fotos.
    remotePatterns: [new URL(process.env.PHOTOS_PUBLIC_BASE_URL ?? 'http://localhost:9000/**')],
  },
};

export default nextConfig;
