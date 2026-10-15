import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/constants";

/**
 * Owner decision (15 Oct 2026): AI search and answer engines may read and
 * cite the site; crawlers that only collect training data may not.
 * A bot obeys only the most specific group that names it, so every group
 * repeats the /admin and /api blocks.
 */
const PRIVATE = ["/admin", "/api"];

// Training-only crawlers and AI-training opt-out tokens (not search engines:
// Google-Extended does not affect Google Search or AI Overviews).
const TRAINING = ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "Applebot-Extended", "Bytespider", "meta-externalagent"];

// AI search indexes and on-demand fetchers: they cite and link the site.
const AI_SEARCH = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"];

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      { userAgent: TRAINING, disallow: "/" },
      { userAgent: AI_SEARCH, allow: "/", disallow: PRIVATE },
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
