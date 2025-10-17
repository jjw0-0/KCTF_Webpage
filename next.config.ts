/**
 * Next.js 프레임워크 설정 파일
 * Next.js의 동작 방식, 빌드 옵션, 최적화 설정을 정의
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: 'standalone', // Docker 프로덕션 빌드용
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
