import { NextResponse, type NextRequest } from "next/server";
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Admin-App", "ListenUp-Admin");
  response.headers.set("X-Request-Path", request.nextUrl.pathname);
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
