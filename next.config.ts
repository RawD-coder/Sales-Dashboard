/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Mengabaikan peringatan ESLint saat Vercel melakukan build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Mengabaikan error ketat TypeScript saat Vercel melakukan build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
