"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verificarSesion } from "@/lib/sesion";
import { leerJson } from "@/lib/github";
import { guardarControl, guardarCorreccion, describeCambio, CONTROL_DEFECTO, REGLAS, type Control } from "@/lib/control";
import { MAX_FRANJAS, esHora, sigueVigente, type Franja, type Programacion } from "@/lib/programacion";
import { madridEn, madridPartes } from "@/lib/formato";

async function exigirMandos(): Promise<void> {
  const c = await cookies();
  const s = await verificarSesion(c.get("drc_sesion")?.value);
  if (!s) redirect("/entrar?a=/panel");
  if (s.rol !== "mandos") redirect("/panel?error=" + encodeURIComponent("Solo quien entra con la clave de mandos puede cambiar el panel."));
}

function fallo(msg: string): never {
  redirect("/panel?error=" + encodeURIComponent(msg));
}

/** "AAAA-MM-DDTHH:MM" escrito en hora de Madrid a ISO UTC. */
function deLocal(valor: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor);
  if (!m) return null;
  return madridEn(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])).toISOString();
}

const ATAJOS: Record<string, number[]> = { todos: [1, 2, 3, 4, 5, 6, 7], lv: [1, 2, 3, 4, 5], ls: [1, 2, 3, 4, 5, 6], finde: [6, 7] };

function leerProgramacion(fd: FormData, ahora: Date, base: Programacion): Programacion {
  const tipo = String(fd.get("prog_tipo") || base.tipo);
  if (tipo === "siempre") return { tipo: "siempre", zona: "Europe/Madrid" };
  if (tipo === "apagado") return { tipo: "apagado", zona: "Europe/Madrid" };
  if (tipo === "hasta") {
    const h = deLocal(String(fd.get("prog_hasta") || ""));
    if (!h) fallo("Pon la fecha y la hora de fin en Hasta una fecha y hora.");
    if (new Date(h) <= ahora) fallo("La fecha y hora de fin ya pasó.");
    return { tipo: "hasta", hasta: h, zona: "Europe/Madrid" };
  }
  if (tipo === "ventana") {
    const d = deLocal(String(fd.get("ventana_desde") || "")), h = deLocal(String(fd.get("ventana_hasta") || ""));
    if (!d || !h) fallo("Entre dos fechas: pon el inicio y el fin, con fecha y hora.");
    if (new Date(h) <= new Date(d)) fallo("Entre dos fechas: el fin tiene que ser posterior al inicio.");
    if (new Date(h) <= ahora) fallo("Entre dos fechas: ese tramo ya terminó.");
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
  if (!franjas.length) fallo("Horario por días: pon al menos una franja con días y horas.");
  return { tipo: "franjas", franjas, zona: "Europe/Madrid" };
}

const RAPIDOS = ["r1h", "r2h", "r4h", "rhoy", "rfinde"];

export async function guardarPanel(formData: FormData): Promise<void> {
  await exigirMandos();
  const ahora = new Date();
  const accion = String(formData.get("accion") || "guardar");
  const actual = (await leerJson<Control>("control.json"))?.data ?? null;
  const base: Control = JSON.parse(JSON.stringify(actual || CONTROL_DEFECTO));
  const nuevo: Control = { ...base };

  const ft = String(formData.get("fase_tope") || base.fase_tope);
  nuevo.fase_tope = ft === "explicacion" ? "explicacion" : "precio";
  nuevo.grupo_pct = Math.max(0, Math.min(100, Math.round(Number(formData.get("grupo_pct")) || 0)));
  const reglas: Record<string, boolean> = {};
  REGLAS.forEach(([k]) => { reglas[k] = k === "fase_tope" ? true : formData.get("regla_" + k) === "on"; });
  nuevo.reglas = reglas;

  const confirmado = formData.get("confirmo") === "on";
  const pideConfirmar = accion === "encender" || accion === "apagado_total" || RAPIDOS.includes(accion);
  if (pideConfirmar && !confirmado) fallo("Marca la casilla de confirmación antes de cambiar el estado del bot.");

  let prog: Programacion;
  if (RAPIDOS.includes(accion)) {
    nuevo.modo = "autonomo";
    if (accion === "r1h" || accion === "r2h" || accion === "r4h") prog = { tipo: "hasta", hasta: new Date(ahora.getTime() + Number(accion[1]) * 3600e3).toISOString(), zona: "Europe/Madrid", q: accion.slice(1) };
    else if (accion === "rhoy") { const o = madridPartes(ahora); prog = { tipo: "hasta", hasta: madridEn(o.y, o.m, o.d, 21, 0).toISOString(), zona: "Europe/Madrid", q: "hoy" }; if (new Date(prog.hasta as string) <= ahora) fallo("Ya pasaron las 21:00 de hoy."); }
    else prog = { tipo: "franjas", franjas: [{ dias: [6, 7], desde: "00:00", hasta: "00:00" }], zona: "Europe/Madrid" };
  } else {
    prog = leerProgramacion(formData, ahora, base.programacion);
    if (accion === "encender") {
      nuevo.modo = "autonomo";
      if (!sigueVigente(prog, ahora)) fallo("Para encender, elige cuándo responde: la programación está parada o ya terminó.");
    } else if (accion === "apagar") nuevo.modo = "propone";
    else if (accion === "apagado_total") nuevo.modo = "apagado";
  }
  nuevo.programacion = prog;

  const at = ahora.toISOString();
  nuevo.actualizado = { at, por: "mandos" };
  if (nuevo.modo === "autonomo") nuevo.autonomo_desde = actual?.modo === "autonomo" && actual.autonomo_desde ? actual.autonomo_desde : at;
  else delete nuevo.autonomo_desde;
  delete nuevo.nota;
  const etiqueta = accion === "encender" || RAPIDOS.includes(accion) ? "encendido" : accion === "apagar" ? "apagado" : accion === "apagado_total" ? "parado" : "guardado";
  try {
    await guardarControl(nuevo, describeCambio(actual, nuevo), "mandos");
  } catch (e) {
    fallo("No se pudo guardar: " + (e as Error).message.slice(0, 160));
  }
  redirect("/panel?ok=" + etiqueta);
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
  redirect("/panel?ok=correccion");
}
