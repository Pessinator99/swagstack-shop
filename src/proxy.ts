import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function routeRequiresAuth(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return true;
  if (pathname === "/cart" || pathname.startsWith("/cart/")) return true;
  if (pathname.startsWith("/warenkorb")) return true;
  if (pathname.startsWith("/checkout")) return true;
  if (pathname.startsWith("/konto")) return true;
  if (pathname.startsWith("/bestellung")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return response;
  }

  if (!user && routeRequiresAuth(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/shop", request.url));
  }

  if (user && pathname.startsWith("/admin")) {
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!adminRow) {
      return NextResponse.redirect(new URL("/shop", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next internals)
     * - favicon, robots, sitemap
     * - api/stripe/webhook (handles raw body itself)
     * - image files
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
