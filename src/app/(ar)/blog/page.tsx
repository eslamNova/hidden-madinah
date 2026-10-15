import { setRequestLocale } from "next-intl/server";
import { BlogView, blogMetadata } from "@/views/blog";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return blogMetadata("ar");
}

export default function BlogPage() {
  setRequestLocale("ar");
  return <BlogView lang="ar" />;
}
