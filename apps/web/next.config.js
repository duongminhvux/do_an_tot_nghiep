/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid exhausting build workers when Docker exposes every host CPU.
  experimental: { cpus: 2 },
  async redirects() {
    return [
      { source: '/:locale(vi|en)/vocabulary/:collectionSlug/lessons/:lessonSlug', destination: '/:locale/vocabulary/collection/:collectionSlug/lesson/:lessonSlug', permanent: false },
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
