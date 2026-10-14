"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verificarSesion } from "@/lib/sesion";
import { leerJson } from "@/lib/github";
import { guardarControl, guardarCorreccion, describeCambio, CONTROL_DEFECTO, REGLAS, type Control, type Programacion } from "@/lib/control";
import { madridEn, madridPartes } from "@/lib/formato";

async function exigirMandos(): Promise<void> {
  const c = await cookies();
  const s = await verificarSesion(c.get("drc_sesion")?.value);
  if (!s) redirect("/entrar?a=/panel");
  if (s.rol !== "mandos") redirect("/panel?error=" + encodeURIComponent("Solo quien entra con la clave de mandos puede cambiar el panel."));
}

function deLocal(valor: string): string | null {
  // "AAAA-MM-DDTHH:MM" en hora de Madrid -> ISO en UTC
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor);
  if (!m) return null;
  return madridEn(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])).toISOString();
}

export async function guardarPanel(formData: FormData): Promise<void> {
  await exigirMandos();
  const ahora = new Date();
  const actual = (await leerJson<Control>("control.json"))?.data ?? null;
  const base: Control = JSON.parse(JSON.stringify(actual || CONTROL_DEFECTO));
  const nuevo: Control = { ...base };
  const modo = String(formData.get("modo") || base.modo);
  nuevo.modo = modo === "autonomo" || modo === "apagado" ? modo : "propone";
  const ft = String(formData.get("fase_tope") || base.fase_tope);
  nuevo.fase_tope = ft === "precio" ? "precio" : "explicacion";
  nuevo.grupo_pct = Math.max(0, Math.min(100, Math.round(Number(formData.get("grupo_pct")) || 0)));
  const reglas: Record<string, boolean> = {};
  REGLAS.forEach(([k]) => { reglas[k] = k === "fase_tope" ? true : formData.get("regla_" + k) === "on"; });
  nuevo.reglas = reglas;

  const rapido = String(formData.get("rapido") || "");
  let prog: Programacion;
  if (rapido === "off") { nuevo.modo = "propone"; prog = { tipo: "apagado", zona: "Europe/Madrid" }; }
  else if (rapido === "1h" || rapido === "2h" || rapido === "4h") { nuevo.modo = "autonomo"; prog = { tipo: "hasta", hasta: new Date(ahora.getTime() + Number(rapido[0]) * 3600e3).toISOString(), zona: "Europe/Madrid", q: rapido }; }
  else if (rapido === "hoy") { nuevo.modo = "autonomo"; const o = madridPartes(ahora); prog = { tipo: "hasta", hasta: madridEn(o.y, o.m, o.d, 21, 0).toISOString(), zona: "Europe/Madrid", q: "hoy" }; }
  else if (rapido === "finde") { nuevo.modo = "autonomo"; prog = { tipo: "franjas", franjas: [{ dias: [6, 7], desde: "00:00", hasta: "23:59" }], zona: "Europe/Madrid" }; }
  else if (rapido === "siempre") { nuevo.modo = "autonomo"; prog = { tipo: "siempre", zona: "Europe/Madrid" }; }
  else if (rapido === "franjas") { nuevo.modo = "autonomo"; prog = { tipo: "franjas", franjas: [{ dias: [1, 2, 3, 4, 5, 6], desde: "08:30", hasta: "21:00" }], zona: "Europe/Madrid" }; }
  else {
    const tipo = String(formData.get("prog_tipo") || base.programacion?.tipo || "franjas");
    if (tipo === "siempre") prog = { tipo: "siempre", zona: "Europe/Madrid" };
    else if (tipo === "apagado") prog = { tipo: "apagado", zona: "Europe/Madrid" };
    else if (tipo === "hasta") {
      const h = deLocal(String(formData.get("prog_hasta") || "")) || base.programacion?.hasta || new Date(ahora.getTime() + 3600e3).toISOString();
      prog = { tipo: "hasta", hasta: h, zona: "Europe/Madrid" };
    } else {
      const dias = [1, 2, 3, 4, 5, 6, 7].filter((d) => formData.get("dia_" + d) === "on");
      const desde = /^\d{2}:\d{2}$/.test(String(formData.get("franja_desde"))) ? String(formData.get("franja_desde")) : "08:30";
      const hasta = /^\d{2}:\d{2}$/.test(String(formData.get("franja_hasta"))) ? String(formData.get("franja_hasta")) : "21:00";
      prog = { tipo: "franjas", franjas: [{ dias: dias.length ? dias : [1, 2, 3, 4, 5, 6], desde, hasta }], zona: "Europe/Madrid" };
    }
  }
  nuevo.programacion = prog;
  const at = ahora.toISOString();
  nuevo.actualizado = { at, por: "mandos" };
  if (nuevo.modo === "autonomo") nuevo.autonomo_desde = actual?.modo === "autonomo" && actual.autonomo_desde ? actual.autonomo_desde : at;
  else delete nuevo.autonomo_desde;
  delete nuevo.nota;
  try {
    await guardarControl(nuevo, describeCambio(actual, nuevo), "mandos");
  } catch (e) {
    redirect("/panel?error=" + encodeURIComponent("No se pudo guardar: " + (e as Error).message.slice(0, 160)));
  }
  redirect("/panel?ok=1");
}

export async function guardarCorreccionAccion(formData: FormData): Promise<void> {
  await exigirMandos();
  const texto = String(formData.get("texto") || "").trim().slice(0, 1000);
  if (!texto) redirect("/panel?error=" + encodeURIComponent("Escribe la corrección primero."));
  try {
    await guardarCorreccion(texto, "mandos");
  } catch (e) {
    redirect("/panel?error=" + encodeURIComponent("No se pudo guardar: " + (e as Error).message.slice(0, 160)));
  }
  redirect("/panel?ok=2");
}
