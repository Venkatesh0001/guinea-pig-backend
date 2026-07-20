const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.1.4'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

module.exports = nextConfig;
