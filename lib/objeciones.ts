// Las objeciones de los leads: cuántos las ponen, si el equipo envía lo que propone el bot, si el bot sigue el método y propone el
// recurso que indica, y si el lead avanza después. Puro y sin red. Los datos los deja el bot (objeciones.py, drc-respond) en
// objeciones/AAAA-MM-DD.jsonl: una línea por propuesta, clasificada por una IA (0,68 de coincidencia entre dos pasadas en el tipo
// exacto, el 10/10/2026), sin el texto del lead. Se cruzan con las métricas de siempre (estado de cada propuesta y etapa de cada lead).
import type { Fila } from "./datos";
import { EV } from "./analisis";
import { addDias } from "./formato";

export type FilaObj = {
  fecha: string; cid: number; id: number; etapa: string;
  objecion: string; indicado: string; propuesto: string; sigue: "si" | "parcial" | "no";
  motivo?: string; barra: string; estado: string; grupo?: string;
};

export const NINGUNA = "NINGUNA";
export const MIN_LEADS_TIPO = 3;      // un tipo con menos leads que esto no se enseña en la portada
export const MIN_MADURAS = 10;        // leads con tiempo de avanzar necesarios para dar un % de avance
export const DIAS_MADURAR = 3;        // una objeción de hace menos de 3 días no cuenta para el avance: aún no ha dado tiempo

export const NOMBRE_OBJ: Record<string, string> = {
  PRECIO_ALTO: "Le parece caro", PAGO_DE_GOLPE: "No quiere pagar de golpe", SIN_DINERO_AHORA: "Sin dinero ahora", COMPARA_PRECIO: "Compara precio",
  COMPROMISO_DURACION: "No quiere 6 o 9 meses", CLASE_DE_PRUEBA: "Pide clase de prueba", CONFIANZA_EMPRESA: "No se fía de pagar", DUDA_RESULTADOS: "Duda de que funcione",
  COMPARA_ALTERNATIVAS: "Compara alternativas", TIEMPO_DISPONIBILIDAD: "No tiene tiempo", HORARIO_PROFESOR: "Horario o profesor", LO_TIENE_QUE_PENSAR: "Lo tiene que pensar",
  MAS_ADELANTE: "Empezará más adelante", NO_ES_LO_QUE_BUSCABA: "Buscaba otra cosa", FORMATO_ONLINE: "Duda del formato online", PRECIO_CARRITO_DISTINTO: "Precio del carrito distinto",
  NO_RECIBIO_LO_PEDIDO: "No recibió lo que pidió", INTENSIDAD_HORAS: "Demasiadas horas", DECIDE_OTRA_PERSONA: "Decide otra persona", RECHAZA_PROSPECCION: "Rechaza el mensaje frío",
  OTRA: "Otra",
};
export const NOMBRE_REC: Record<string, string> = {
  aislar_objecion: "Aislar la objeción", fraccionado: "Pago fraccionado", mensual: "Mensual", video_plataforma: "Vídeo de la plataforma", testimonio: "Testimonio",
  resenas: "Reseñas", resumen_y_garantia: "Resumen y garantía", garantia: "Garantía", programa_desbloqueo: "Programa Desbloqueo", programa_acelerado: "Programa Acelerado",
  empieza_ya: "Reservar ya", competencia: "Valor frente a otras opciones", horario_alternativo: "Otro horario", ninguno: "Respuesta directa", otro: "Otro",
};

const nombreObj = (k: string) => NOMBRE_OBJ[k] ?? k;
const nombreRec = (k: string) => NOMBRE_REC[k] ?? k;
const ETAPAS_AVANCE = new Set(["horario", "cierre"]);

function masFrecuente(xs: string[]): string | null {
  const c = new Map<string, number>();
  xs.forEach((x) => c.set(x, (c.get(x) || 0) + 1));
  let mejor: string | null = null, n = 0;
  c.forEach((v, k) => { if (v > n) { mejor = k; n = v; } });
  return mejor;
}
const pct = (a: number, b: number): number | null => (b ? a / b : null);

export type ResumenTipo = {
  tipo: string; nombre: string; leads: number; pct: number; propuestas: number;
  copia: number | null;          // % de las propuestas que la persona envía tal cual (de las que tuvieron respuesta)
  sigue: number | null;          // % de las propuestas que siguen el método para esa objeción
  coincide: number | null;       // % de las propuestas cuyo recurso es el que indica el método
  avanza: number | null;         // % de los leads que luego llegan a horario o cierre, o ya son alumnos
  nAvanza: number;               // leads con los que se calcula (los que han tenido tiempo)
  indicado: string | null; propuesto: string | null;   // lo más habitual, con nombre legible
};
export type Desajuste = { tipo: string; nombre: string; indicado: string; propuesto: string; n: number; pct: number };
export type Objeciones = {
  desde: string; hasta: string; propuestas: number; leadsConObjecion: number;
  tipos: ResumenTipo[];
  global: { sigue: number | null; coincide: number | null; copia: number | null };
  desajustes: Desajuste[];
};

/** `metricas`: filas de ventas (estado y etapa de cada propuesta); `hoy`: AAAA-MM-DD, para saber qué objeciones han tenido tiempo. */
export function objeciones(filas: FilaObj[], metricas: Fila[], alumnos: Set<number>, hoy: string): Objeciones | null {
  const con = filas.filter((f) => f.objecion && f.objecion !== NINGUNA);
  if (!con.length) return null;
  const leadsConObjecion = new Set(con.map((f) => f.cid)).size;
  // lo que pasó después con cada lead: fechas en que llegó a horario o cierre
  const avance = new Map<number, string[]>();
  metricas.forEach((m) => { if (ETAPAS_AVANCE.has(m.etapa)) { const a = avance.get(m.contact_id) || []; a.push(m.fecha); avance.set(m.contact_id, a); } });
  const limite = addDias(hoy, -DIAS_MADURAR);

  const porTipo = new Map<string, FilaObj[]>();
  con.forEach((f) => { const a = porTipo.get(f.objecion) || []; a.push(f); porTipo.set(f.objecion, a); });
  const tipos: ResumenTipo[] = [...porTipo.entries()].map(([tipo, rs]) => {
    const leads = new Set(rs.map((r) => r.cid));
    const primera = new Map<number, string>();
    rs.forEach((r) => { const f = primera.get(r.cid); if (!f || r.fecha < f) primera.set(r.cid, r.fecha); });
    const maduras = [...primera.entries()].filter(([, f]) => f <= limite);
    const avanzan = maduras.filter(([cid, f]) => alumnos.has(cid) || (avance.get(cid) || []).some((d) => d > f)).length;
    const evaluadas = rs.filter((r) => EV.has(r.estado));
    return {
      tipo, nombre: nombreObj(tipo), leads: leads.size, pct: leads.size / leadsConObjecion, propuestas: rs.length,
      copia: pct(evaluadas.filter((r) => r.estado === "usada").length, evaluadas.length),
      sigue: pct(rs.filter((r) => r.sigue === "si").length, rs.length),
      coincide: pct(rs.filter((r) => r.propuesto === r.indicado).length, rs.length),
      avanza: maduras.length >= MIN_MADURAS ? avanzan / maduras.length : null, nAvanza: maduras.length,
      indicado: (() => { const k = masFrecuente(rs.map((r) => r.indicado)); return k ? nombreRec(k) : null; })(),
      propuesto: (() => { const k = masFrecuente(rs.map((r) => r.propuesto)); return k ? nombreRec(k) : null; })(),
    };
  }).sort((a, b) => b.leads - a.leads || (a.nombre < b.nombre ? -1 : 1));

  const evaluadas = con.filter((r) => EV.has(r.estado));
  const pares = new Map<string, { tipo: string; indicado: string; propuesto: string; n: number }>();
  // "Otra" y los casos en que el método no pide ningún recurso no dicen si el bot se equivoca de contenido: fuera de los desajustes
  con.filter((r) => r.propuesto !== r.indicado && r.objecion !== "OTRA" && r.indicado !== "ninguno").forEach((r) => {
    const k = r.objecion + "|" + r.indicado + "|" + r.propuesto;
    const e = pares.get(k) || { tipo: r.objecion, indicado: r.indicado, propuesto: r.propuesto, n: 0 };
    e.n++; pares.set(k, e);
  });
  const desajustes = [...pares.values()].filter((p) => p.n >= 5).sort((a, b) => b.n - a.n).slice(0, 6).map((p) => ({
    tipo: p.tipo, nombre: nombreObj(p.tipo), indicado: nombreRec(p.indicado), propuesto: nombreRec(p.propuesto), n: p.n,
    pct: p.n / (porTipo.get(p.tipo) || []).length,
  }));
  return {
    desde: con.reduce((m, f) => (f.fecha < m ? f.fecha : m), con[0].fecha), hasta: con.reduce((m, f) => (f.fecha > m ? f.fecha : m), con[0].fecha),
    propuestas: con.length, leadsConObjecion, tipos,
    global: {
      sigue: pct(con.filter((r) => r.sigue === "si").length, con.length), coincide: pct(con.filter((r) => r.propuesto === r.indicado).length, con.length),
      copia: pct(evaluadas.filter((r) => r.estado === "usada").length, evaluadas.length),
    },
    desajustes,
  };
}
