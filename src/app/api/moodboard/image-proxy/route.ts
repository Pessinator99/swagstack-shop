import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "source.unsplash.com",
  "picsum.photos",
  "fastly.picsum.photos",
  "images.unsplash.com",
] as const;

function isAllowedHostname(hostname: string): boolean {
  for (const h of ALLOWED_HOSTS) {
    if (hostname === h || hostname.endsWith(`.${h}`)) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam?.trim()) {
    return new NextResponse("Missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (target.protocol !== "https:") {
    return new NextResponse("Only https URLs allowed", { status: 403 });
  }

  if (!isAllowedHostname(target.hostname)) {
    return new NextResponse("Domain not allowed", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SwagstackMoodboard/1.0)" },
      next: { revalidate: 3600 },
    });
  } catch {
    return new NextResponse("Upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse("Upstream error", { status: 502 });
  }

  const buffer = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
