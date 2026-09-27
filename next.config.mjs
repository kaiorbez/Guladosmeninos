/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fotos de produto vão pelo formulário (já reduzidas no navegador).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
