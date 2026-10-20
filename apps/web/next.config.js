/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/:locale(vi|en)/arena/friend', destination: '/:locale/arena', permanent: false },
      { source: '/:locale(vi|en)/arena/group', destination: '/:locale/arena', permanent: false },
      { source: '/:locale(vi|en)/arena/group/:matchId', destination: '/:locale/arena/friend/:matchId', permanent: false },
      { source: '/:locale(vi|en)/vocabulary/collection', destination: '/:locale/vocabulary', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
