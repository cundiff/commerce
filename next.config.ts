const apiUrl = process.env.NOPCOMMERCE_API_URL;

// Allow product images served by the nopCommerce instance. The media host is
// derived from NOPCOMMERCE_API_URL; additional hosts (e.g. a CDN/blob storage
// plugin) can be added via NOPCOMMERCE_IMAGE_HOSTNAMES (comma-separated).
const remotePatterns: {
  protocol: "http" | "https";
  hostname: string;
}[] = [];

if (apiUrl) {
  try {
    const url = new URL(apiUrl);
    remotePatterns.push({
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
    });
  } catch {
    // ignore malformed URL; remotePatterns simply won't include it
  }
}

for (const extra of (process.env.NOPCOMMERCE_IMAGE_HOSTNAMES ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean)) {
  remotePatterns.push({ protocol: "https", hostname: extra });
}

export default {
  experimental: {
    ppr: true,
    inlineCss: true,
    useCache: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns,
  },
};
