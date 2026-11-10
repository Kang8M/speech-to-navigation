import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Biểu tượng của Next.js che thanh trạng thái ghim ở góc dưới trang eForm khi demo
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
