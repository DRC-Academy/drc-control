// Los cálculos del centro de control. Mismas definiciones que el dashboard del 14/10/2026.
import type { Fila } from "./datos";
import { addDias, semanaDe } from "./formato";

export const EV = new Set(["usada", "equivalente", "valida", "error_sin_mencion", "disputa"]);
export const FASES: [string, string][] = [
  ["cualificacion", "Cualificación"], ["explicacion", "Explicación"], ["precio", "Precio"],
  ["objecion", "Objeción"], ["horario", "Horario"], ["cierre", "Cierre"],
];
export const NOMBRE: Record<string, string> = Object.fromEntries(FASES);
NOMBRE.seguimiento = "Seguimiento";
NOMBRE.otro = "Otro";
export const EMBUDO = ["cualificacion", "explicacion", "precio", "horario", "cierre"];
export const EMBUDO_N = ["Cualificación", "Explicación", "Precio", "Horario", "Cierre"];
export const UMBRAL = { uso: 0.85, corr: 3, n: 100 };
export const LIM = { resp_min: 10, lat_s: 60, barrido: 0.3 };

const usada = (r: Fila) => r.estado === "usada" || r.estado === "equivalente";
const errorH = (r: Fila) => r.estado === "error_sin_mencion" || r.estado === "disputa";

export function mediana(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function maxFecha(v: Fila[]): string {
  return v.reduce((m, r) => (r.fecha > m ? r.fecha : m), "");
}

export type Dia = {
  dia: string; propuestas: number; evaluadas: number; uso: number | null; correcciones: number; errores_humano: number;
  caducadas: number; sin_humano: number; sin_respuesta: number; tarde: number; barrido: number; pct_barrido: number;
  contestadas: number; pct_10min: number | null; resp_med_min: number | null; lat_med_s: number | null;
};
export function porDia(v: Fila[]): Dia[] {
  const dias = new Map<string, { resp: number[]; lat: number[]; d: Dia }>();
  v.forEach((r) => {
    let e = dias.get(r.fecha);
    if (!e) {
      e = { resp: [], lat: [], d: { dia: r.fecha, propuestas: 0, evaluadas: 0, uso: null, correcciones: 0, errores_humano: 0, caducadas: 0, sin_humano: 0, sin_respuesta: 0, tarde: 0, barrido: 0, pct_barrido: 0, contestadas: 0, pct_10min: null, resp_med_min: null, lat_med_s: null } };
      dias.set(r.fecha, e);
    }
    const d = e.d;
    d.propuestas++;
    if (EV.has(r.estado)) { d.evaluadas++; if (usada(r)) d.uso = (d.uso || 0) + 1; if (errorH(r)) d.errores_humano++; }
    if (r.estado === "correccion") d.correcciones++;
    if (r.estado === "caducada") d.caducadas++;
    if (r.estado === "sin_humano") d.sin_humano++;
    if (r.tarde) d.tarde++;
    if (r.origen === "barrido") d.barrido++;
    if (r.respuesta_s != null) e.resp.push(r.respuesta_s);
    if (r.origen === "evento" && r.latencia_s != null) e.lat.push(r.latencia_s);
  });
  return [...dias.values()].sort((a, b) => (a.d.dia < b.d.dia ? -1 : 1)).map((e) => {
    const d = e.d;
    const usadas = d.uso || 0;
    d.uso = d.evaluadas ? usadas / d.evaluadas : null;
    d.sin_respuesta = d.caducadas + d.sin_humano;
    d.pct_barrido = d.propuestas ? d.barrido / d.propuestas : 0;
    d.contestadas = e.resp.length;
    d.pct_10min = e.resp.length ? e.resp.filter((x) => x <= 600).length / e.resp.length : null;
    const rm = mediana(e.resp);
    d.resp_med_min = rm == null ? null : rm / 60;
    d.lat_med_s = mediana(e.lat);
    return d;
  });
}

export type Periodo = {
  periodo: "actual" | "anterior"; desde: string; hasta: string; propuestas: number; por_dia: number; evaluadas: number; uso: number | null;
  correcciones: number; errores_humano: number; sin_respuesta: number; tarde: number; pct_barrido: number; contestadas: number;
  pct_10min: number | null; resp_med_min: number | null; lat_med_s: number | null; leads_nuevos: number; leads_dia: number;
};
export function periodos(v: Fila[]): Periodo[] {
  if (!v.length) return [];
  const max = maxFecha(v);
  const primero = new Map<number, string>();
  v.forEach((r) => { const f = primero.get(r.contact_id); if (!f || r.fecha < f) primero.set(r.contact_id, r.fecha); });
  const defs: ["actual" | "anterior", string, string][] = [["actual", addDias(max, -6), max], ["anterior", addDias(max, -13), addDias(max, -7)]];
  return defs.map(([periodo, a, b]) => {
    const rs = v.filter((r) => r.fecha >= a && r.fecha <= b);
    const e = rs.filter((r) => EV.has(r.estado));
    const resp = rs.filter((r) => r.respuesta_s != null).map((r) => r.respuesta_s as number);
    const lat = rs.filter((r) => r.origen === "evento" && r.latencia_s != null).map((r) => r.latencia_s as number);
    const nuevos = [...primero.values()].filter((d) => d >= a && d <= b).length;
    const rm = mediana(resp);
    return {
      periodo, desde: a, hasta: b, propuestas: rs.length, por_dia: rs.length / 7, evaluadas: e.length,
      uso: e.length ? e.filter(usada).length / e.length : null,
      correcciones: rs.filter((r) => r.estado === "correccion").length,
      errores_humano: e.filter(errorH).length,
      sin_respuesta: rs.filter((r) => r.estado === "caducada" || r.estado === "sin_humano").length,
      tarde: rs.filter((r) => r.tarde).length,
      pct_barrido: rs.length ? rs.filter((r) => r.origen === "barrido").length / rs.length : 0,
      contestadas: resp.length,
      pct_10min: resp.length ? resp.filter((x) => x <= 600).length / resp.length : null,
      resp_med_min: rm == null ? null : rm / 60,
      lat_med_s: mediana(lat),
      leads_nuevos: nuevos, leads_dia: nuevos / 7,
    };
  });
}

export type FaseStat = {
  fase: string; nombre: string; n: number; uso: number | null; corr100: number | null; err100: number | null;
  uso_ant: number | null; n_ant: number; cumple: number; veredicto: "lista" | "casi" | "no";
};
export function fases(v: Fila[], ventana: number): FaseStat[] {
  if (!v.length) return [];
  const max = maxFecha(v);
  const a = addDias(max, -(ventana - 1)), a2 = addDias(max, -(2 * ventana - 1)), b2 = addDias(max, -ventana);
  return FASES.map(([fase, nombre]) => {
    const st = (x: string, y: string) => {
      const rs = v.filter((r) => r.etapa === fase && r.fecha >= x && r.fecha <= y);
      const e = rs.filter((r) => EV.has(r.estado));
      const n = e.length;
      return {
        n,
        uso: n ? e.filter(usada).length / n : null,
        corr: n ? (rs.filter((r) => r.estado === "correccion").length / n) * 100 : null,
        err: n ? (e.filter(errorH).length / n) * 100 : null,
      };
    };
    const A = st(a, max), B = st(a2, b2);
    const c = [A.n >= UMBRAL.n, A.uso != null && A.uso >= UMBRAL.uso, A.corr != null && A.corr <= UMBRAL.corr].filter(Boolean).length;
    const veredicto: FaseStat["veredicto"] = c === 3 ? "lista" : c === 2 ? "casi" : "no";
    return { fase, nombre, n: A.n, uso: A.uso, corr100: A.corr, err100: A.err, uso_ant: B.uso, n_ant: B.n, cumple: c, veredicto };
  });
}
export function hastaDonde(rows: FaseStat[]): string | null {
  let ultima: string | null = null;
  for (const k of ["cualificacion", "explicacion", "precio"]) {
    const r = rows.find((x) => x.fase === k);
    if (r && r.veredicto === "lista") ultima = k;
    else break;
  }
  return ultima;
}

export type SemanaFase = { semana: string; n: number; uso: number };
export function usoSemanal(v: Fila[], fase: string, minimo = 20): SemanaFase[] {
  const m = new Map<string, { n: number; u: number }>();
  v.filter((r) => r.etapa === fase && EV.has(r.estado)).forEach((r) => {
    const k = semanaDe(r.fecha);
    const e = m.get(k) || { n: 0, u: 0 };
    e.n++; if (usada(r)) e.u++;
    m.set(k, e);
  });
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([semana, e]) => ({ semana, n: e.n, uso: e.u / e.n })).filter((r) => r.n >= minimo);
}
export function usoDiario(v: Fila[], minimo = 20): { dia: string; n: number; uso: number }[] {
  const m = new Map<string, { n: number; u: number }>();
  v.filter((r) => EV.has(r.estado)).forEach((r) => { const e = m.get(r.fecha) || { n: 0, u: 0 }; e.n++; if (usada(r)) e.u++; m.set(r.fecha, e); });
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([dia, e]) => ({ dia, n: e.n, uso: e.u / e.n })).filter((r) => r.n >= minimo);
}

export type Grupo = {
  grupo: string; contactos: number; llegan_precio: number | null; ventas: number; conv: number | null; pct_10min: number | null;
  errores: number; traspasos: number; traspasos_ia: number; traspasos_fase: number; traspasos_otros: number;
};
export function grupos(v: Fila[], alumnos: Set<number>): Grupo[] {
  const con = v.filter((r) => r.grupo);
  if (!con.length) return [];
  return ["bot", "control"].map((grupo) => {
    const c = new Map<number, { max: number; alumno: boolean; tras: string; resp: number[]; err: number }>();
    con.filter((r) => r.grupo === grupo).forEach((r) => {
      const o = c.get(r.contact_id) || { max: -1, alumno: false, tras: "", resp: [], err: 0 };
      const i = EMBUDO.indexOf(r.etapa);
      if (i > o.max) o.max = i;
      if (alumnos.has(r.contact_id)) o.alumno = true;
      if (r.traspaso) o.tras = r.traspaso;
      if (r.respuesta_s != null) o.resp.push(r.respuesta_s);
      if (errorH(r) || r.estado === "correccion") o.err++;
      c.set(r.contact_id, o);
    });
    const cs = [...c.values()], n = cs.length, resp = cs.flatMap((o) => o.resp);
    const tras: Record<string, number> = {};
    cs.forEach((o) => { if (o.tras) tras[o.tras] = (tras[o.tras] || 0) + 1; });
    const ventas = cs.filter((o) => o.alumno).length;
    return {
      grupo, contactos: n,
      llegan_precio: n ? cs.filter((o) => o.max >= 2).length / n : null,
      ventas, conv: n ? ventas / n : null,
      pct_10min: resp.length ? resp.filter((x) => x <= 600).length / resp.length : null,
      errores: cs.reduce((s, o) => s + o.err, 0),
      traspasos: cs.filter((o) => o.tras).length,
      traspasos_ia: tras.pregunta_ia || 0, traspasos_fase: tras.fase_tope || 0,
      traspasos_otros: Object.keys(tras).filter((k) => k !== "pregunta_ia" && k !== "fase_tope").reduce((s, k) => s + tras[k], 0),
    };
  });
}

export type Stats = {
  n: number; uso: number; valida: number; error: number; corr: number; lat: number; contactos: number; ventas: number; conv: number;
  reach: number[]; fase: Record<string, { n: number; uso: number }>;
};
export function stats(todas: Fila[], a: string, b: string, alumnos: Set<number>): Stats {
  const v = todas.filter((r) => r.fecha >= a && r.fecha <= b);
  const e = v.filter((r) => EV.has(r.estado));
  const n = e.length;
  const c = (f: (s: string) => boolean) => e.filter((r) => f(r.estado)).length;
  const lat = mediana(v.filter((r) => r.origen === "evento" && r.latencia_s != null).map((r) => r.latencia_s as number));
  const primero = new Map<number, string>(), mx = new Map<number, number>();
  todas.forEach((r) => {
    const f = primero.get(r.contact_id); if (!f || r.fecha < f) primero.set(r.contact_id, r.fecha);
    const i = EMBUDO.indexOf(r.etapa); if (i >= 0) mx.set(r.contact_id, Math.max(mx.get(r.contact_id) ?? -1, i));
  });
  const co = [...primero.entries()].filter(([k, d]) => d >= a && d <= b && mx.has(k)).map(([k]) => k);
  const reach = EMBUDO.map((_, i) => co.filter((k) => (mx.get(k) ?? -1) >= i).length);
  const ventas = co.filter((k) => alumnos.has(k)).length;
  const fase: Record<string, { n: number; uso: number }> = {};
  FASES.forEach(([k]) => { const x = e.filter((r) => r.etapa === k); fase[k] = { n: x.length, uso: x.length ? x.filter(usada).length / x.length : 0 }; });
  return {
    n, uso: n ? c((s) => s === "usada" || s === "equivalente") / n : 0, valida: n ? c((s) => s === "valida") / n : 0,
    error: n ? c((s) => s === "error_sin_mencion" || s === "disputa") / n : 0,
    corr: n ? (v.filter((r) => r.estado === "correccion").length / n) * 100 : 0,
    lat: lat || 0, contactos: co.length, ventas, conv: co.length ? ventas / co.length : 0, reach, fase,
  };
}
export function sig(p1: number, n1: number, p2: number, n2: number): "pequeña" | "clara" | "no concluyente" {
  if (n1 < 30 || n2 < 30) return "pequeña";
  const pp = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2));
  if (!se) return "no concluyente";
  return Math.abs((p1 - p2) / se) > 1.96 ? "clara" : "no concluyente";
}
