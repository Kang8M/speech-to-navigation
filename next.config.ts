import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Biểu tượng của Next.js che thanh trạng thái ghim ở góc dưới trang eForm khi demo
  devIndicators: false,
  // Gói native (.node + DLL onnxruntime) nhận dạng giọng nói: để Node nạp trực tiếp, không đóng gói
  serverExternalPackages: ["sherpa-onnx-node"],
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
