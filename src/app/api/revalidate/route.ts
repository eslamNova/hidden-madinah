import { revalidateBoth } from "@/lib/revalidate";
import { NextResponse } from "next/server";

/**
 * Secret-guarded on-demand revalidation for out-of-app callers (the media
 * import script). Admin server actions call revalidatePath directly instead.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    secret?: string;
    paths?: string[];
  } | null;

  if (!body || !process.env.REVALIDATE_SECRET || body.secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === "string") : [];
  for (const path of paths) revalidateBoth(path);

  return NextResponse.json({ ok: true, revalidated: paths });
}
