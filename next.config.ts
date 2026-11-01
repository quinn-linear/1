import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The share image route reads the archetype art from disk, so make sure it ships with that function.
  outputFileTracingIncludes: { "/s/[token]/image": ["./public/archetypes/share/**/*"] },
};

export default nextConfig;
