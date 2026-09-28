import { NextResponse } from "next/server";
import { getGlass, glassPublicObjectUrl } from "@/lib/glass";

/** Public-ish proxy for Glass object bytes (blobber banner/avatar). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    // Prefer public URL redirect when available
    try {
      const res = NextResponse.redirect(glassPublicObjectUrl(id), 302);
      res.headers.set(
        "Cache-Control",
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      );
      return res;
    } catch {
      /* fall through to download */
    }

    const glass = getGlass();
    const res = await glass.objects.download(id);
    if (!res.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const bytes = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("Glass object proxy failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 502 });
  }
}
