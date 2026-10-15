import { setRequestLocale } from "next-intl/server";
import { BlogView, blogMetadata } from "@/views/blog";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return blogMetadata("en");
}

export default function BlogPage() {
  setRequestLocale("en");
  return <BlogView lang="en" />;
}
