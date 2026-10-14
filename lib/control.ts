// El estado del panel: control.json y sus compañeros en la rama estado del bot. El bot lo lee; la app lo escribe.
import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { leerJson, escribirJson } from "./github";
import { DIAS_N, fmtFecha, madridPartes } from "./formato";
import { NOMBRE } from "./analisis";

export type Franja = { dias: number[]; desde: string; hasta: string };
export type Programacion = { tipo: "siempre" | "hasta" | "franjas" | "apagado"; hasta?: string; franjas?: Franja[]; zona: "Europe/Madrid"; q?: string };
export type Control = {
  modo: "propone" | "autonomo" | "apagado";
  fase_tope: "explicacion" | "precio";
  grupo_pct: number;
  autonomo_desde?: string;
  programacion: Programacion;
  reglas: Record<string, boolean>;
  actualizado?: { at: string; por: string };
  nota?: string;
};
export type Aplicado = { sha?: string; leido_en?: string; modo_efectivo?: string; programacion_activa?: boolean; autonomo_disponible?: boolean };
export type Historial = { items: { at: string; por: string; cambio: string }[] };
export type Correccion = { id: string; at: string; por: string; texto: string; estado: "pendiente" | "aplicada" };
export type Correcciones = { items: Correccion[] };

export const REGLAS: [string, string][] = [
  ["pregunta_ia", "El lead pregunta si habla con una IA o un bot: el bot lo reconoce con sinceridad y pasa la conversación a ventas"],
  ["pide_persona", "El lead pide hablar con una persona"],
  ["fase_tope", "Llega a la fase tope (siempre)"],
  ["objecion", "Aparece una objeción: precio, confianza, tiempo, lo tiene que pensar"],
  ["guardia", "La guardia de cumplimiento rechaza el mensaje del bot"],
  ["sin_dato", "Falta un dato que el bot no tiene (propuesta de tipo consultar)"],
  ["enfado", "Queja, enfado o tema delicado"],
];

export const CONTROL_DEFECTO: Control = {
  modo: "propone", fase_tope: "explicacion", grupo_pct: 20,
  programacion: { tipo: "franjas", franjas: [{ dias: [1, 2, 3, 4, 5, 6], desde: "08:30", hasta: "21:00" }], zona: "Europe/Madrid" },
  reglas: { pregunta_ia: true, pide_persona: true, fase_tope: true, objecion: true, guardia: true, sin_dato: true, enfado: true },
};

export function programada(c: Control, ahora: Date): { activo: boolean; motivo: string } {
  const pr = c.programacion || { tipo: "apagado" };
  if (c.modo !== "autonomo") return { activo: false, motivo: c.modo === "apagado" ? "el bot está apagado" : "el bot está en modo propone" };
  if (pr.tipo === "siempre") return { activo: true, motivo: "siempre" };
  if (pr.tipo === "apagado") return { activo: false, motivo: "parado" };
  if (pr.tipo === "hasta") {
    const h = new Date(pr.hasta || "");
    if (Number.isNaN(h.getTime())) return { activo: false, motivo: "fecha no válida" };
    return h > ahora ? { activo: true, motivo: "hasta las " + fmtFecha(pr.hasta) } : { activo: false, motivo: "terminó el " + fmtFecha(pr.hasta) };
  }
  if (pr.tipo === "franjas") {
    const m = madridPartes(ahora);
    const f = (pr.franjas || []).find((x) => (x.dias || []).includes(m.wd) && x.desde <= m.hm && m.hm < x.hasta);
    return f ? { activo: true, motivo: "franja de " + f.desde + " a " + f.hasta } : { activo: false, motivo: "fuera de franja" };
  }
  return { activo: false, motivo: "sin programación" };
}

export function describeProg(c: Control): string {
  const pr = c.programacion || { tipo: "apagado" };
  if (c.modo !== "autonomo") return "Sin modo autónomo";
  if (pr.tipo === "siempre") return "Siempre (dentro del horario del bot)";
  if (pr.tipo === "apagado") return "Parado";
  if (pr.tipo === "hasta") return "Hasta el " + fmtFecha(pr.hasta);
  if (pr.tipo === "franjas") return (pr.franjas || []).map((f) => (f.dias || []).map((d) => DIAS_N[d]).join(", ") + " de " + f.desde + " a " + f.hasta).join("; ") || "Sin franjas";
  return "Sin programación";
}

export function resumen(c: Control | null): string {
  if (!c) return "Nada guardado todavía.";
  let t = c.modo === "autonomo"
    ? "Responde solo al " + (c.grupo_pct ?? 0) + " % de los leads nuevos hasta " + (NOMBRE[c.fase_tope] || c.fase_tope).toLowerCase() + ". " + describeProg(c) + "."
    : c.modo === "apagado" ? "Apagado." : "Propone y una persona envía.";
  if (c.actualizado?.at) t += " Guardado el " + fmtFecha(c.actualizado.at) + (c.actualizado.por ? " (" + c.actualizado.por + ")" : "") + ".";
  return t;
}

export function describeCambio(a: Control | null, b: Control): string {
  const M: Record<string, string> = { propone: "propone", autonomo: "responde solo", apagado: "apagado" };
  const partes: string[] = [];
  if (!a || a.modo !== b.modo) partes.push("modo " + (a ? M[a.modo] + " → " : "") + M[b.modo]);
  if (!a || a.fase_tope !== b.fase_tope) partes.push("fase tope " + (NOMBRE[b.fase_tope] || b.fase_tope).toLowerCase());
  if (!a || a.grupo_pct !== b.grupo_pct) partes.push("grupo " + b.grupo_pct + " %");
  if (!a || JSON.stringify(a.programacion) !== JSON.stringify(b.programacion)) partes.push("programación: " + describeProg(b));
  if (!a || JSON.stringify(a.reglas) !== JSON.stringify(b.reglas)) partes.push("reglas de traspaso cambiadas");
  return partes.join("; ") || "sin cambios";
}

export type EstadoPanel = { control: Control | null; sha: string | null; aplicado: Aplicado | null; historial: Historial; correcciones: Correcciones; error: string | null };

async function cargarEstado(): Promise<EstadoPanel> {
  try {
    const [c, a, h, r] = await Promise.all([
      leerJson<Control>("control.json"), leerJson<Aplicado>("control-aplicado.json"),
      leerJson<Historial>("control-historial.json"), leerJson<Correcciones>("control-correcciones.json"),
    ]);
    return { control: c?.data ?? null, sha: c?.sha ?? null, aplicado: a?.data ?? null, historial: h?.data ?? { items: [] }, correcciones: r?.data ?? { items: [] }, error: null };
  } catch (e) {
    return { control: null, sha: null, aplicado: null, historial: { items: [] }, correcciones: { items: [] }, error: (e as Error).message };
  }
}
export const leerEstadoPanel = unstable_cache(cargarEstado, ["panel"], { revalidate: 60, tags: ["control"] });

export async function guardarControl(nuevo: Control, cambio: string, por: string): Promise<void> {
  const actual = await leerJson<Control>("control.json");
  await escribirJson("control.json", nuevo, "control: " + cambio.slice(0, 120), actual?.sha);
  const h = await leerJson<Historial>("control-historial.json");
  const items = [...(h?.data.items ?? []).slice(-199), { at: nuevo.actualizado?.at || new Date().toISOString(), por, cambio }];
  await escribirJson("control-historial.json", { items }, "control: historial", h?.sha);
  revalidateTag("control");
}

export async function guardarCorreccion(texto: string, por: string): Promise<void> {
  const r = await leerJson<Correcciones>("control-correcciones.json");
  const items = [...(r?.data.items ?? []).slice(-199), { id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), por, texto, estado: "pendiente" as const }];
  await escribirJson("control-correcciones.json", { items }, "control: corrección pendiente", r?.sha);
  revalidateTag("control");
}
