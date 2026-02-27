/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // En Next.js 14.2+ serverComponentsExternalPackages sale de experimental
  serverComponentsExternalPackages: ['twilio'],
};

export default nextConfig;
