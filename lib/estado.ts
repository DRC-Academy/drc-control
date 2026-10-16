// Estado del bot de un vistazo: funciona bien, va lento, tiene problemas, fuera de horario o apagado.
// Puro (sin red ni Next): se calcula a partir de lo que deja el bot en la rama estado y se prueba suelto.
//   salud/AAAA-MM-DD.jsonl  una línea por turno: ok, tarde, fallo (con latencia en segundos)
//   vigilante.json          el vigilante del bot: estado "problema" con su causa
//   rescates.json           chats que llevan demasiado esperando sugerencia (avisadas) y los rescates lanzados
import { madridPartes } from "./formato";
import { mediana } from "./analisis";

export type FilaSalud = { ts: number; cid?: number; r: string; lat?: number; error?: string };
export type EstadoVigilante = { estado?: string; causa?: string; desde?: number; codigo?: string } | null;
export type EstadoRescates = { chats?: Record<string, { intentos?: number }>; avisadas?: Record<string, string> } | null;
export type Nivel = "ok" | "aviso" | "mal" | "parado" | "fuera";
export type SaludBot = {
  nivel: Nivel; titulo: string; detalle: string;
  esperando: number; hoy: number; ultima_s: number | null; lat_s: number | null;
};
export type EntradaSalud = {
  filas: FilaSalud[]; vigilante: EstadoVigilante; rescates: EstadoRescates;
  modo: "propone" | "autonomo" | "apagado" | null; ahora: Date;
};

export const VENTANA_S = 30 * 60;     // los turnos que se miran
export const MIN_FALLOS = 3;          // fallos para dar un problema por cierto...
export const PCT_FALLOS = 0.5;        // ...y que sean al menos la mitad de los turnos
export const LENTA_S = 300;           // mediana a partir de la cual va lento (los mismos 5 minutos que el vigilante)
export const MIN_MUESTRAS_LENTA = 3;
export const LAT_MAX_S = 3 * 3600;    // una sugerencia que llega más de 3 h después del mensaje es un lead de la noche (se atiende al abrir): no cuenta para la velocidad
export const ABRE_MIN = 8 * 60 + 30;  // el bot actúa de 8:30 a 21:00, hora de Madrid
export const CIERRA_MIN = 21 * 60;

export function dur(s: number): string {
  const n = Math.round(s);
  if (n < 90) return n + " s";
  const m = Math.floor(n / 60), r = n % 60;
  if (m < 10 && r) return m + " min " + r + " s";
  return m + " min";
}

export function hace(s: number): string {
  if (s < 90) return "hace un momento";
  const m = Math.round(s / 60);
  if (m < 60) return "hace " + m + " min";
  const h = Math.floor(m / 60), r = m % 60;
  return "hace " + h + " h" + (r ? " " + r + " min" : "");
}

export function calcularSalud(e: EntradaSalud): SaludBot {
  const ahoraS = Math.floor(e.ahora.getTime() / 1000);
  const m = madridPartes(e.ahora);
  const minuto = Number(m.hm.slice(0, 2)) * 60 + Number(m.hm.slice(3));
  const buenas = e.filas.filter((f) => f.r === "ok" || f.r === "tarde");
  const recientes = e.filas.filter((f) => f.ts >= ahoraS - VENTANA_S);
  const buenasRec = recientes.filter((f) => f.r === "ok" || f.r === "tarde");
  const fallosRec = recientes.filter((f) => f.r === "fallo");
  const lats = buenasRec.map((f) => f.lat).filter((x): x is number => typeof x === "number" && x <= LAT_MAX_S);
  const lat = mediana(lats);
  const ultimaTs = buenas.length ? Math.max(...buenas.map((f) => f.ts)) : null;
  const ultima_s = ultimaTs == null ? null : Math.max(0, ahoraS - ultimaTs);
  const esperando = Object.keys(e.rescates?.avisadas ?? {}).length;
  const base = { esperando, hoy: buenas.length, ultima_s, lat_s: lat };

  if (e.modo === "apagado") {
    return { ...base, nivel: "parado", titulo: "Bot apagado", detalle: "No sugiere ni responde. Se vuelve a encender en Ajustes." };
  }
  if (minuto < ABRE_MIN || minuto >= CIERRA_MIN) {
    const vuelve = minuto < ABRE_MIN ? "Vuelve a las 8:30." : "Vuelve mañana a las 8:30.";
    return { ...base, nivel: "fuera", titulo: "Fuera de horario", detalle: vuelve + (buenas.length ? " Hoy ha dado " + buenas.length + (buenas.length === 1 ? " sugerencia." : " sugerencias.") : "") };
  }
  const muchosFallos = fallosRec.length >= MIN_FALLOS && fallosRec.length / Math.max(1, recientes.length) >= PCT_FALLOS;
  if (e.vigilante?.estado === "problema" || muchosFallos) {
    const causa = e.vigilante?.estado === "problema" && e.vigilante.causa ? e.vigilante.causa : "Las sugerencias están fallando.";
    return { ...base, nivel: "mal", titulo: "Con problemas", detalle: causa.endsWith(".") ? causa : causa + "." };
  }
  if (esperando > 0) {
    return { ...base, nivel: "aviso", titulo: "Hay chats sin sugerencia", detalle: esperando + (esperando === 1 ? " chat lleva" : " chats llevan") + " más de lo normal esperando. Se está reintentando solo." };
  }
  if (lat != null && lats.length >= MIN_MUESTRAS_LENTA && lat > LENTA_S) {
    return { ...base, nivel: "aviso", titulo: "Va lento", detalle: "Las sugerencias tardan " + dur(lat) + " de media." };
  }
  const partes: string[] = [];
  if (ultima_s != null) partes.push("Última sugerencia " + hace(ultima_s));
  if (lat != null) partes.push("tarda " + dur(lat));
  if (buenas.length) partes.push(buenas.length + " hoy");
  return { ...base, nivel: "ok", titulo: "Funciona bien", detalle: partes.length ? partes.join(" · ") : "Sin mensajes nuevos todavía hoy." };
}
