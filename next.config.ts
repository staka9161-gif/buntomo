import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "cover.openbd.jp" },
      { hostname: "ndlsearch.ndl.go.jp" },
      { hostname: "thumbnail.image.rakuten.co.jp" },
      { hostname: "books.google.com" },
      { hostname: "*.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
