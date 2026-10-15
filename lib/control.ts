// El estado del panel: control.json y sus compañeros en la rama estado del bot. El bot lo lee; la app lo escribe.
import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { leerJson, escribirJson } from "./github";
import { fmtFecha } from "./formato";
import { activa, describir, type Franja, type Programacion } from "./programacion";
import { NOMBRE } from "./analisis";

export type { Franja, Programacion };
// Etapas del embudo en orden (las mismas que el bot, ORDEN_FASES en copiloto.py): el bot contesta hasta la elegida incluida
// y pasa el chat a una persona en cuanto la conversación llega a una etapa posterior.
export const FASES_TOPE = ["cualificacion", "explicacion", "precio", "objecion", "horario", "cierre"] as const;
export type FaseTope = (typeof FASES_TOPE)[number];
export const FASES_TOPE_OPCIONES: [FaseTope, string][] = [
  ["cualificacion", "Cualificación (el bot pregunta y una persona explica)"],
  ["explicacion", "Explicación (el precio lo da una persona)"],
  ["precio", "Precio (el bot da el precio y luego entra una persona)"],
  ["objecion", "Objeción (el bot también gestiona las objeciones, si quitas la regla de traspaso)"],
  ["horario", "Horario (el bot también propone el horario)"],
  ["cierre", "Cierre (hasta el mensaje previo al pago: el enlace de pago lo envía una persona)"],
];
const FASE_FRASE: Record<string, string> = {
  cualificacion: "la cualificación", explicacion: "la explicación", precio: "el precio",
  objecion: "las objeciones", horario: "el horario", cierre: "el cierre",
};
export function describeFase(f: string): string {
  return FASE_FRASE[f] || f;
}

export type Control = {
  modo: "propone" | "autonomo" | "apagado";
  fase_tope: FaseTope;
  grupo_pct: number;
  autonomo_desde?: string;
  programacion: Programacion;
  reglas: Record<string, boolean>;
  actualizado?: { at: string; por: string };
  nota?: string;
};
export type Aplicado = { sha?: string; leido_en?: string; modo_efectivo?: string; programacion_activa?: boolean; autonomo_disponible?: boolean; parada?: { desde?: string; motivo?: string } };
export type Historial = { items: { at: string; por: string; cambio: string }[] };
export type Correccion = { id: string; at: string; por: string; texto: string; estado: "pendiente" | "aplicada" };
export type Correcciones = { items: Correccion[] };

export const REGLAS: [string, string][] = [
  ["pregunta_ia", "El lead pregunta si habla con una IA o con una persona: el bot no contesta nada (ni lo admite ni lo niega) y pasa la conversación a ventas en ese momento"],
  ["pide_persona", "El lead pide hablar con una persona"],
  ["fase_tope", "Llega a la fase tope (siempre)"],
  ["objecion", "Aparece una objeción (precio, confianza, tiempo, lo tiene que pensar): pasa a una persona aunque la fase tope la incluya. Si la quitas, el bot la gestiona solo cuando la fase tope llega a objeción o más"],
  ["guardia", "La guardia de cumplimiento rechaza el mensaje del bot"],
  ["sin_dato", "Falta un dato que el bot no tiene, o hay algo que una persona tiene que comprobar o enviar aparte (propuesta de tipo consultar, o con nota en objeción, horario y cierre)"],
  ["enfado", "Queja, enfado o tema delicado"],
];

export const CONTROL_DEFECTO: Control = {
  modo: "propone", fase_tope: "precio", grupo_pct: 20,
  programacion: { tipo: "franjas", franjas: [{ dias: [1, 2, 3, 4, 5, 6], desde: "08:30", hasta: "21:00" }], zona: "Europe/Madrid" },
  reglas: { pregunta_ia: true, pide_persona: true, fase_tope: true, objecion: true, guardia: true, sin_dato: true, enfado: true },
};

export function programada(c: Control, ahora: Date): { activo: boolean; motivo: string } {
  if (c.modo !== "autonomo") return { activo: false, motivo: c.modo === "apagado" ? "el bot está apagado" : "el bot está en modo propone" };
  return activa(c.programacion, ahora);
}

export function describeProg(c: Control): string {
  if (c.modo !== "autonomo") return "Sin modo autónomo";
  return describir(c.programacion);
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
  const [c, a, h, r] = await Promise.all([
    leerJson<Control>("control.json"), leerJson<Aplicado>("control-aplicado.json"),
    leerJson<Historial>("control-historial.json"), leerJson<Correcciones>("control-correcciones.json"),
  ]);
  return { control: c?.data ?? null, sha: c?.sha ?? null, aplicado: a?.data ?? null, historial: h?.data ?? { items: [] }, correcciones: r?.data ?? { items: [] }, error: null };
}
const leerEstadoPanelCache = unstable_cache(cargarEstado, ["panel"], { revalidate: 60, tags: ["control"] });
// Un fallo de GitHub no se cachea: se enseña y se vuelve a intentar en la siguiente carga.
export async function leerEstadoPanel(): Promise<EstadoPanel> {
  try {
    return await leerEstadoPanelCache();
  } catch (e) {
    return { control: null, sha: null, aplicado: null, historial: { items: [] }, correcciones: { items: [] }, error: (e as Error).message };
  }
}

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
