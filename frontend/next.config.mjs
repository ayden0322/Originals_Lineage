import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 後端 API 內部位址（給 rewrites 用）
// 本地：http://localhost:4000/api
// Docker Compose：http://backend:4000/api
// Zeabur：走 INTERNAL_API_URL 或 NEXT_PUBLIC_API_URL
const BACKEND_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['antd', '@ant-design/cssinjs', '@ant-design/nextjs-registry'],
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    return config;
  },
  // 推廣連結 /api/public/originals/ref/:code 反向代理到後端
  // 必須走前端域名才能讓 cookie 寫在前端（register 頁面才讀得到 ref_code）
  async rewrites() {
    return [
      {
        source: '/api/public/originals/ref/:code',
        destination: `${BACKEND_API_URL}/public/originals/ref/:code`,
      },
    ];
  },
};

export default nextConfig;
