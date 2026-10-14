// Formato de números y fechas, y hora de Madrid. Sin dependencias.

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const DIAS_N = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export const esNum = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);
export const p0 = (v: number | null | undefined): string => (esNum(v) ? Math.round(v * 100) + " %" : "—");
export const p1 = (v: number | null | undefined): string => (esNum(v) ? (v * 100).toFixed(1).replace(".", ",") + " %" : "—");
export const f0 = (v: number | null | undefined): string => (esNum(v) ? Math.round(v).toLocaleString("es-ES") : "—");
export const f1 = (v: number | null | undefined): string =>
  esNum(v) ? v.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—";
export const pts = (v: number): string => (v > 0 ? "+" : "") + v.toFixed(0) + " pts";

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function hoyIso(): string {
  return iso(new Date());
}
export function addDias(s: string, n: number): string {
  return iso(new Date(new Date(s + "T00:00:00Z").getTime() + n * 864e5));
}
export function fmtDia(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return s;
  return d.getUTCDate() + " " + MESES[d.getUTCMonth()];
}
export function semanaDe(s: string): string {
  const d = new Date(s + "T00:00:00Z");
  const wd = (d.getUTCDay() + 6) % 7;
  return iso(new Date(d.getTime() - wd * 864e5));
}

export type PartesMadrid = { y: number; m: number; d: number; wd: number; hm: string };
const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function madridPartes(d: Date): PartesMadrid {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const o: Record<string, string> = {};
  p.forEach((x) => { o[x.type] = x.value; });
  const hh = String(Number(o.hour) % 24).padStart(2, "0");
  return { y: Number(o.year), m: Number(o.month), d: Number(o.day), wd: WD[o.weekday] || 0, hm: hh + ":" + o.minute };
}
export function madridOffsetMin(d: Date): number {
  const o = madridPartes(d);
  const comoUTC = Date.UTC(o.y, o.m - 1, o.d, Number(o.hm.slice(0, 2)), Number(o.hm.slice(3)));
  return Math.round((comoUTC - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}
export function madridEn(y: number, m: number, d: number, hh: number, mm: number): Date {
  const aprox = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return new Date(aprox.getTime() - madridOffsetMin(aprox) * 60000);
}
export function fmtFecha(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr);
  const o = madridPartes(d);
  return o.d + "/" + String(o.m).padStart(2, "0") + " " + o.hm;
}
export function aDatetimeLocal(isoStr: string | undefined): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const o = madridPartes(d);
  return o.y + "-" + String(o.m).padStart(2, "0") + "-" + String(o.d).padStart(2, "0") + "T" + o.hm;
}
