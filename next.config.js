/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages for server components - don't bundle heavy parser libs
  serverExternalPackages: ['tesseract.js', 'pdf-parse', 'mammoth', 'papaparse'],
  outputFileTracingRoot: process.cwd(),
  // Webpack configuration to handle pdf-parse issues
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude test files from the build
      config.externals = config.externals || [];
      config.externals.push({
        './test/data/05-versions-space.pdf': 'commonjs ./test/data/05-versions-space.pdf',
        './test/data/01-valid.pdf': 'commonjs ./test/data/01-valid.pdf',
        './test/data/02-valid.pdf': 'commonjs ./test/data/02-valid.pdf',
        './test/data/03-invalid.pdf': 'commonjs ./test/data/03-invalid.pdf',
        './test/data/04-valid.pdf': 'commonjs ./test/data/04-valid.pdf',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
