import { NextResponse, type NextRequest } from "next/server";
import { verificarSesion } from "@/lib/sesion";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|entrar|api/salud).*)"],
};

export async function middleware(req: NextRequest) {
  const sesion = await verificarSesion(req.cookies.get("drc_sesion")?.value);
  if (sesion) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  if (req.nextUrl.pathname !== "/") url.searchParams.set("a", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
