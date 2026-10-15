import { setRequestLocale } from "next-intl/server";
import { ArticleView, articleMetadata, articleStaticParams } from "@/views/article";

export const revalidate = 86400;

export function generateStaticParams() {
  return articleStaticParams();
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  setRequestLocale("ar");
  return articleMetadata("ar", params);
}

export default function ArticlePage({ params }: Props) {
  setRequestLocale("ar");
  return <ArticleView lang="ar" params={params} />;
}
