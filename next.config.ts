import type { NextConfig } from "next";

// Dev only: extra hosts allowed to load dev resources (HMR), e.g. a phone on the
// local network. Comma-separated in `.env.local` (ALLOWED_DEV_ORIGINS), so a
// personal LAN IP never lands in git. Production ignores this option.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
