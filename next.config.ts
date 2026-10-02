import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo reset reads the sample invoice texts from disk; make sure they are
  // bundled with that serverless function on Vercel.
  outputFileTracingIncludes: {
    "/api/demo/reset": ["./public/sample-invoices/**/*"],
  },
};

export default nextConfig;
