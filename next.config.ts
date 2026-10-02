import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp es un módulo nativo: se carga desde node_modules en el servidor, no se empaqueta.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
