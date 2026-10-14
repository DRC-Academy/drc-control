"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { firmarSesion, rolDeClave, verificarSesion } from "@/lib/sesion";

export async function entrar(formData: FormData): Promise<void> {
  const clave = String(formData.get("clave") || "");
  const a = String(formData.get("a") || "/salud");
  const rol = rolDeClave(clave);
  if (!rol) {
    await new Promise((r) => setTimeout(r, 800));
    redirect("/entrar?error=1" + (a && a !== "/salud" ? "&a=" + encodeURIComponent(a) : ""));
  }
  const token = await firmarSesion(rol);
  if (!token) redirect("/entrar?error=2");
  const c = await cookies();
  c.set("drc_sesion", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  redirect(a.startsWith("/") ? a : "/salud");
}

export async function salir(): Promise<void> {
  const c = await cookies();
  c.delete("drc_sesion");
  redirect("/entrar");
}

export async function refrescar(ruta: string): Promise<void> {
  const c = await cookies();
  const s = await verificarSesion(c.get("drc_sesion")?.value);
  if (!s) redirect("/entrar");
  revalidateTag("metricas");
  revalidateTag("control");
  revalidateTag("alumnos");
  redirect(ruta.startsWith("/") ? ruta : "/salud");
}
