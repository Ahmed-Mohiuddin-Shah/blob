import { NextResponse } from "next/server";
import { isPublicHttpUrl, pickSiteIcon } from "@/lib/site-icon";

export const runtime = "nodejs";

const CACHE =
  "public, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw || !isPublicHttpUrl(raw)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const res = await fetch(raw, {
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
      headers: {
        Accept: "text/html",
        "User-Agent": "BLOB-site-icon/1.0",
      },
    });
    if (!res.ok || !isPublicHttpUrl(res.url)) {
      return new NextResponse(null, { status: 404 });
    }
    const html = (await res.text()).slice(0, 120_000);
    const icon =
      pickSiteIcon(html, res.url) ??
      new URL("/favicon.ico", res.url).href;
    if (!isPublicHttpUrl(icon)) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.redirect(icon, {
      status: 302,
      headers: { "Cache-Control": CACHE },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
