import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";

/** Same as next-auth's reqWithEnvURL — OAuth callback origin must follow AUTH_URL. */
function reqWithEnvURL(req: NextRequest): NextRequest {
  const url = process.env.AUTH_URL;
  if (!url) return req;
  const { origin: envOrigin } = new URL(url);
  const { href, origin } = req.nextUrl;
  return new NextRequest(href.replace(origin, envOrigin), req);
}

export async function GET(req: NextRequest) {
  return handlers.GET(reqWithEnvURL(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(reqWithEnvURL(req));
}
