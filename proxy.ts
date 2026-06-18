import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const AUTH_PATH = "/secure-access-portal";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuth = !!req.auth;

  const isAuthPage = pathname.startsWith(AUTH_PATH);
  const isApiAuth = pathname.startsWith("/api/auth");
  const isInvitePage = pathname.startsWith("/invites/");
  // F12-K79: public share linki — bez auth (token w URL je gate'uje).
  const isSharePage = pathname.startsWith("/share/");
  const isPublic =
    pathname === "/" || isAuthPage || isApiAuth || isInvitePage || isSharePage;

  if (!isAuth && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = AUTH_PATH;
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuth && isAuthPage) {
    return NextResponse.redirect(new URL("/workspaces", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
