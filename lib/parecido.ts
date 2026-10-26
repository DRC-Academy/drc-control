// Parecido a Diego (26/10/2026): cada noche el bot compara su propuesta con lo que Diego envió a ese mismo mensaje del lead
// (parecido del texto de 0 a 1) y lo guarda en parecido-diego.jsonl de la rama estado. Aquí se resume. Puro, con tests.
import { addDias, semanaDe } from "./formato";

export type FilaPar = { fecha: string; cid: number; etapa: string; parecido: number };
export type Tramo = { n: number; media: number | null; altas: number | null };
export type Parecido = {
  ult: Tramo; prev: Tramo; delta: number | null; desde: string; hasta: string;
  semanas: { x: string; y: number | null; n: number }[];
};

export const PARECIDO_ALTO = 0.5;   // desde aquí cuenta como "muy parecida" (igual que el bot)
export const SEMANAS = 8;

function tramo(v: number[]): Tramo {
  if (!v.length) return { n: 0, media: null, altas: null };
  return { n: v.length, media: v.reduce((a, b) => a + b, 0) / v.length, altas: v.filter((x) => x >= PARECIDO_ALTO).length / v.length };
}

/** Últimos 7 días frente a los 7 anteriores, y la media por semana (lunes a domingo) de las últimas 8. Null sin datos. */
export function parecidoDiego(filas: FilaPar[], hoy: string): Parecido | null {
  const validas = filas.filter((f) => f.fecha && Number.isFinite(f.parecido));
  if (!validas.length) return null;
  const desde = addDias(hoy, -6), desdePrev = addDias(hoy, -13);
  const ult = tramo(validas.filter((f) => f.fecha >= desde && f.fecha <= hoy).map((f) => f.parecido));
  const prev = tramo(validas.filter((f) => f.fecha >= desdePrev && f.fecha < desde).map((f) => f.parecido));
  const delta = ult.media != null && prev.media != null ? (ult.media - prev.media) * 100 : null;
  const lunes = semanaDe(hoy);
  const semanas = Array.from({ length: SEMANAS }, (_, i) => addDias(lunes, -7 * (SEMANAS - 1 - i))).map((x) => {
    const t = tramo(validas.filter((f) => semanaDe(f.fecha) === x).map((f) => f.parecido));
    return { x, y: t.media, n: t.n };
  });
  const primera = semanas.findIndex((s) => s.n > 0);
  return { ult, prev, delta, desde, hasta: hoy, semanas: primera < 0 ? [] : semanas.slice(primera) };
}

export function leerFilasParecido(texto: string | null): FilaPar[] {
  const out: FilaPar[] = [];
  (texto || "").split("\n").forEach((l) => {
    const s = l.trim();
    if (!s) return;
    try {
      const r = JSON.parse(s) as Record<string, unknown>;
      const v = Number(r.parecido);
      if (r.fecha && Number.isFinite(v)) out.push({ fecha: String(r.fecha).slice(0, 10), cid: Number(r.cid) || 0, etapa: String(r.etapa || ""), parecido: v });
    } catch {
      /* línea rota: se ignora */
    }
  });
  return out;
}
