"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verificarSesion } from "@/lib/sesion";
import { leerJson } from "@/lib/github";
import { guardarControl, guardarCorreccion, describeCambio, CONTROL_DEFECTO, REGLAS, FASES_TOPE, type Control, type FaseTope } from "@/lib/control";
import { MAX_FRANJAS, esHora, type Franja, type Programacion } from "@/lib/programacion";
import { madridEn } from "@/lib/formato";

async function exigirMandos(): Promise<void> {
  const c = await cookies();
  const s = await verificarSesion(c.get("drc_sesion")?.value);
  if (!s) redirect("/entrar?a=/ajustes");
  if (s.rol !== "mandos") redirect("/ajustes?error=" + encodeURIComponent("Solo quien entra con la clave de mandos puede cambiar los ajustes."));
}

function fallo(msg: string): never {
  redirect("/ajustes?error=" + encodeURIComponent(msg));
}

/** "AAAA-MM-DDTHH:MM" escrito en hora de Madrid a ISO UTC. */
function deLocal(valor: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor);
  if (!m) return null;
  return madridEn(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])).toISOString();
}

const mismoMinuto = (a?: string, b?: string) => !!a && !!b && Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 60000;
const ATAJOS: Record<string, number[]> = { todos: [1, 2, 3, 4, 5, 6, 7], lv: [1, 2, 3, 4, 5], ls: [1, 2, 3, 4, 5, 6], finde: [6, 7] };

function leerProgramacion(fd: FormData, ahora: Date, base: Programacion): Programacion {
  const tipo = String(fd.get("prog_tipo") || base.tipo);
  if (tipo === "siempre") return { tipo: "siempre", zona: "Europe/Madrid" };
  if (tipo === "apagado") return { tipo: "apagado", zona: "Europe/Madrid" };
  if (tipo === "hasta") {
    const h = deLocal(String(fd.get("prog_hasta") || ""));
    if (!h) fallo("Pon la fecha y la hora de fin.");
    // una fecha ya caducada que no se ha tocado no impide guardar otros ajustes
    if (new Date(h) <= ahora) {
      if (base.tipo === "hasta" && mismoMinuto(h, base.hasta)) return base;
      fallo("La fecha y hora de fin ya pasó.");
    }
    return { tipo: "hasta", hasta: h, zona: "Europe/Madrid" };
  }
  if (tipo === "ventana") {
    const d = deLocal(String(fd.get("ventana_desde") || "")), h = deLocal(String(fd.get("ventana_hasta") || ""));
    if (!d || !h) fallo("Entre dos fechas: pon el inicio y el fin, con fecha y hora.");
    if (new Date(h) <= new Date(d)) fallo("Entre dos fechas: el fin tiene que ser posterior al inicio.");
    if (new Date(h) <= ahora) {
      if (base.tipo === "ventana" && mismoMinuto(d, base.desde) && mismoMinuto(h, base.hasta)) return base;
      fallo("Entre dos fechas: ese tramo ya terminó.");
    }
    return { tipo: "ventana", desde: d, hasta: h, zona: "Europe/Madrid" };
  }
  const franjas: Franja[] = [];
  for (let i = 1; i <= MAX_FRANJAS; i++) {
    let dias = [1, 2, 3, 4, 5, 6, 7].filter((d) => fd.get(`f${i}_dia_${d}`) === "on");
    const atajo = i === 1 ? String(fd.get("atajo") || "") : "";
    if (atajo && ATAJOS[atajo]) dias = ATAJOS[atajo];
    const desde = String(fd.get(`f${i}_desde`) || ""), hasta = String(fd.get(`f${i}_hasta`) || "");
    if (!dias.length && !desde && !hasta) continue;
    if (!dias.length) fallo(`Franja ${i}: marca al menos un día.`);
    if (!esHora(desde) || !esHora(hasta)) fallo(`Franja ${i}: pon la hora de inicio y la de fin.`);
    if (desde === hasta && desde !== "00:00") fallo(`Franja ${i}: el inicio y el fin no pueden ser la misma hora (00:00 a 00:00 es el día entero).`);
    franjas.push({ dias, desde, hasta });
  }
  if (!franjas.length) fallo("Horario semanal: pon al menos una franja con días y horas.");
  return { tipo: "franjas", franjas, zona: "Europe/Madrid" };
}

/** Guarda programación, grupo, fase tope y reglas. No enciende ni apaga: eso se hace en la pantalla principal. */
export async function guardarAjustes(formData: FormData): Promise<void> {
  await exigirMandos();
  const ahora = new Date();
  const actual = (await leerJson<Control>("control.json"))?.data ?? null;
  const base: Control = JSON.parse(JSON.stringify(actual || CONTROL_DEFECTO));
  const nuevo: Control = { ...base };
  const ft = String(formData.get("fase_tope") || base.fase_tope);
  nuevo.fase_tope = (FASES_TOPE as readonly string[]).includes(ft) ? (ft as FaseTope) : base.fase_tope;
  nuevo.grupo_pct = Math.max(0, Math.min(100, Math.round(Number(formData.get("grupo_pct")) || 0)));
  const reglas: Record<string, boolean> = {};
  REGLAS.forEach(([k]) => { reglas[k] = k === "fase_tope" ? true : formData.get("regla_" + k) === "on"; });
  nuevo.reglas = reglas;
  nuevo.programacion = leerProgramacion(formData, ahora, base.programacion);
  nuevo.actualizado = { at: ahora.toISOString(), por: "mandos" };
  delete nuevo.nota;
  try {
    await guardarControl(nuevo, describeCambio(actual, nuevo), "mandos");
  } catch (e) {
    fallo("No se pudo guardar: " + (e as Error).message.slice(0, 160));
  }
  redirect("/ajustes?ok=guardado");
}

/** Apaga el bot por completo: ni sugiere ni responde. Pide confirmación (la rellena el navegador tras aceptar el aviso). */
export async function pararBot(formData: FormData): Promise<void> {
  await exigirMandos();
  if (formData.get("confirmo") !== "on") fallo("Hace falta confirmar para apagar el bot por completo.");
  const actual = (await leerJson<Control>("control.json"))?.data ?? null;
  const nuevo: Control = { ...JSON.parse(JSON.stringify(actual || CONTROL_DEFECTO)), modo: "apagado" };
  nuevo.actualizado = { at: new Date().toISOString(), por: "mandos" };
  delete nuevo.autonomo_desde;
  delete nuevo.nota;
  try {
    await guardarControl(nuevo, describeCambio(actual, nuevo), "mandos");
  } catch (e) {
    fallo("No se pudo guardar: " + (e as Error).message.slice(0, 160));
  }
  redirect("/?ok=apagado");
}

export async function guardarCorreccionAccion(formData: FormData): Promise<void> {
  await exigirMandos();
  const texto = String(formData.get("texto") || "").trim().slice(0, 1000);
  if (!texto) fallo("Escribe la corrección primero.");
  try {
    await guardarCorreccion(texto, "mandos");
  } catch (e) {
    fallo("No se pudo guardar: " + (e as Error).message.slice(0, 160));
  }
  redirect("/ajustes?ok=correccion");
}
