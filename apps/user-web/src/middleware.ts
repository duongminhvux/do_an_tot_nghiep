import { NextResponse,type NextRequest } from "next/server";
export function middleware(_request:NextRequest){const response=NextResponse.next();response.headers.set("X-Student-App","ListenUp-Student");return response}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
