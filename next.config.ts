import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El panel de control pasó a Ajustes (16/10/2026): los enlaces guardados siguen funcionando.
  async redirects() {
    return [{ source: "/panel", destination: "/ajustes", permanent: false }];
  },
};

export default nextConfig;
