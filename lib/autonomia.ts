// Hasta dónde puede responder el bot sin ayuda humana: en qué % de las respuestas la persona envía la sugerencia del bot
// tal cual (estado "usada" del árbitro: parecido de texto de al menos el 85 % o la misma barra), fase a fase. Puro y sin red.
// Una respuesta "con otras palabras" (equivalente) o distinta pero válida NO cuenta como copiada: es lo que pidió Diego.
import type { Fila } from "./datos";
import { FASES, EV, maxFecha } from "./analisis";
import { addDias } from "./formato";

export const VENTANA_DIAS = 14;      // días con datos que se miran
export const UMBRAL_COPIA = 0.85;    // % copiado tal cual a partir del cual una fase se da por lista (el mismo 85 % del resto del proyecto)
export const MIN_RESPUESTAS = 50;    // respuestas evaluadas mínimas en la ventana para fiarse de una fase

export type EstadoFase = "lista" | "falla" | "pocos" | "despues";
export type EtapaAutonomia = { fase: string; nombre: string; n: number; copia: number | null; estado: EstadoFase };
export type Autonomia = {
  etapas: EtapaAutonomia[];
  hasta: string | null;          // última fase seguida que pasa el umbral (null: ni la primera)
  hastaNombre: string | null;
  copiaHasta: number | null;     // % copiado tal cual, juntando todas las fases hasta esa
  nHasta: number;
  corta: EtapaAutonomia | null;  // la fase que corta la cadena (no llega al umbral o tiene pocos datos)
  desde: string; hastaFecha: string;
};

export function autonomia(filas: Fila[]): Autonomia | null {
  if (!filas.length) return null;
  const max = maxFecha(filas), desde = addDias(max, -(VENTANA_DIAS - 1));
  const ev = filas.filter((r) => r.fecha >= desde && EV.has(r.estado));
  let enCadena = true, hasta: string | null = null, hastaNombre: string | null = null, corta: EtapaAutonomia | null = null;
  let copiadasHasta = 0, nHasta = 0;
  const etapas: EtapaAutonomia[] = FASES.map(([fase, nombre]) => {
    const rs = ev.filter((r) => r.etapa === fase);
    const n = rs.length, copiadas = rs.filter((r) => r.estado === "usada").length;
    const copia = n ? copiadas / n : null;
    let estado: EstadoFase = "despues";
    if (enCadena) {
      if (n < MIN_RESPUESTAS) estado = "pocos";
      else if ((copia as number) >= UMBRAL_COPIA) estado = "lista";
      else estado = "falla";
      if (estado === "lista") { hasta = fase; hastaNombre = nombre; copiadasHasta += copiadas; nHasta += n; }
      else enCadena = false;
    }
    const e: EtapaAutonomia = { fase, nombre, n, copia, estado };
    if (!enCadena && !corta) corta = e;
    return e;
  });
  return { etapas, hasta, hastaNombre, copiaHasta: nHasta ? copiadasHasta / nHasta : null, nHasta, corta, desde, hastaFecha: max };
}
