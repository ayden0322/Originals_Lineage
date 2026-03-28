/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['antd', '@ant-design/cssinjs', '@ant-design/nextjs-registry'],
};

export default nextConfig;
