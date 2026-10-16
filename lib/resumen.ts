// Lo que enseña la pantalla principal además del estado: el cierre (cuántos leads acaban comprando) y dónde se pierden.
// Puro y sin red; usa las mismas definiciones de analisis.ts (un lead cuenta como venta si hoy es Alumno en Respond).
import type { Fila } from "./datos";
import { stats, grupos, periodos, sig, maxFecha, EMBUDO_N, LIM } from "./analisis";
import { addDias } from "./formato";

export const DIAS_VENTANA = 28;   // leads cuya primera propuesta cae en los últimos 28 días con datos
export const MIN_PASO = 20;       // un paso del embudo solo cuenta como cuello de botella si le llegan al menos 20 leads
export const MIN_COMPARAR = 30;   // leads por lado para comparar al bot con una persona

export type Medida = { leads: number; ventas: number; conv: number | null };
export type Cierre = {
  persona: Medida;
  bot: Medida | null;                                     // solo cuando el bot ya ha contestado a leads solo
  origen: "grupo" | "todos";                              // persona = el grupo de control, o todos los leads atendidos con sugerencias
  veredicto: "pequeña" | "clara" | "no concluyente" | null;
  sinVentas: boolean;                                     // sin conexión a Respond no se puede saber quién compra
};

function medida(leads: number, ventas: number): Medida {
  return { leads, ventas, conv: leads ? ventas / leads : null };
}

export function cierre(filas: Fila[], alumnos: Set<number>): Cierre | null {
  if (!filas.length) return null;
  const max = maxFecha(filas);
  const S = stats(filas, addDias(max, -(DIAS_VENTANA - 1)), max, alumnos);
  const G = grupos(filas, alumnos);
  const gb = G.find((g) => g.grupo === "bot"), gc = G.find((g) => g.grupo === "control");
  const sinVentas = alumnos.size === 0;
  if (gb && gb.contactos > 0 && gc && gc.contactos > 0) {
    const bot = medida(gb.contactos, gb.ventas), persona = medida(gc.contactos, gc.ventas);
    const veredicto = bot.leads < MIN_COMPARAR || persona.leads < MIN_COMPARAR || bot.conv == null || persona.conv == null
      ? ("pequeña" as const) : sig(bot.conv, bot.leads, persona.conv, persona.leads);
    return { persona, bot, origen: "grupo", veredicto, sinVentas };
  }
  return { persona: medida(S.contactos, S.ventas), bot: null, origen: "todos", veredicto: null, sinVentas };
}

export type Paso = { nombre: string; n: number; pct: number; pasa: number | null; peor: boolean };
export type Embudo = {
  leads: number; ventas: number; pasos: Paso[];
  peor: { de: string; a: string; pasa: number } | null;
  desde: string; hasta: string;
};

export function embudo(filas: Fila[], alumnos: Set<number>): Embudo | null {
  if (!filas.length) return null;
  const max = maxFecha(filas), desde = addDias(max, -(DIAS_VENTANA - 1));
  const S = stats(filas, desde, max, alumnos);
  const reach = S.reach;
  const leads = reach[0] || 0;
  if (!leads) return null;
  const pasos: Paso[] = EMBUDO_N.map((nombre, i) => ({
    nombre, n: reach[i], pct: reach[i] / leads, pasa: i && reach[i - 1] ? reach[i] / reach[i - 1] : null, peor: false,
  }));
  let k = -1;
  for (let i = 1; i < pasos.length; i++) {
    if (reach[i - 1] >= MIN_PASO && pasos[i].pasa != null && (k < 0 || (pasos[i].pasa as number) < (pasos[k].pasa as number))) k = i;
  }
  if (k >= 0) pasos[k].peor = true;
  return { leads, ventas: S.ventas, pasos, peor: k >= 0 ? { de: pasos[k - 1].nombre, a: pasos[k].nombre, pasa: pasos[k].pasa as number } : null, desde, hasta: max };
}

export type RespuestaPersonas = { min: number; limite: number; pct10: number | null; mala: boolean };

/** Cuánto tarda una persona en contestar a los leads (mediana de los últimos 7 días con datos), frente al límite de 10 minutos. */
export function respuestaPersonas(filas: Fila[]): RespuestaPersonas | null {
  const A = periodos(filas)[0];
  if (!A || A.resp_med_min == null) return null;
  return { min: A.resp_med_min, limite: LIM.resp_min, pct10: A.pct_10min, mala: A.resp_med_min > LIM.resp_min };
}
