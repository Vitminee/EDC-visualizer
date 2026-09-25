import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || process.env.NEXT_PUBLIC_REPO_NAME || "edc";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: `/${repositoryName}`,
  assetPrefix: `/${repositoryName}/`,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
