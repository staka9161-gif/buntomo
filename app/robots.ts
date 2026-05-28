import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/mypage", "/api", "/admin", "/verify-email"],
    },
    sitemap: "https://buntomo.bunkare.jp/sitemap.xml",
  };
}
