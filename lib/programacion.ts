// Programación de las respuestas automáticas: tipos, evaluación con hora de Madrid y descripción.
// Sin dependencias de Next ni de servidor: se puede probar suelta. Debe coincidir con programacion_activa del bot
// (drc-respond, copiloto.py): ventana con fecha y hora, franjas (hasta 3) que pueden cruzar la medianoche.
import { DIAS_N, fmtFecha, madridPartes, type PartesMadrid } from "./formato";

export type Franja = { dias: number[]; desde: string; hasta: string };
export type Programacion = {
  tipo: "siempre" | "hasta" | "ventana" | "franjas" | "apagado";
  desde?: string;
  hasta?: string;
  franjas?: Franja[];
  zona: "Europe/Madrid";
  q?: string;
};

// Horario en que el bot actúa de verdad hoy (copiloto.py HORARIO y relevo de Cloudflare), hora de Madrid.
export const HORARIO_BOT = { desde: "08:30", hasta: "21:00" };
export const MAX_FRANJAS = 3;

const HHMM = /^\d{2}:\d{2}$/;
export const esHora = (s: unknown): s is string => typeof s === "string" && HHMM.test(s) && Number(s.slice(0, 2)) < 24 && Number(s.slice(3)) < 60;

function diaAnterior(d: number): number {
  return d === 1 ? 7 : d - 1;
}

/** Una franja está activa en este instante. desde > hasta cruza la medianoche; hasta "00:00" es el final del día. */
export function franjaActiva(f: Franja, p: PartesMadrid): boolean {
  const dias = f.dias || [];
  const desde = f.desde || "", hasta = f.hasta || "";
  if (!esHora(desde) || !esHora(hasta)) return false;
  const fin = hasta === "00:00" ? "24:00" : hasta; // 00:00 como fin es el final del día (00:00 a 00:00 es el día entero)
  if (desde < fin) return dias.includes(p.wd) && p.hm >= desde && p.hm < fin;
  if (desde > fin) return (dias.includes(p.wd) && p.hm >= desde) || (dias.includes(diaAnterior(p.wd)) && p.hm < fin);
  return false; // desde === hasta (salvo 00:00 a 00:00): franja vacía
}

export function activa(pr: Programacion | undefined, ahora: Date): { activo: boolean; motivo: string } {
  if (!pr) return { activo: false, motivo: "sin programación" };
  if (pr.tipo === "siempre") return { activo: true, motivo: "siempre" };
  if (pr.tipo === "apagado") return { activo: false, motivo: "parado" };
  if (pr.tipo === "hasta") {
    const h = new Date(pr.hasta || "");
    if (Number.isNaN(h.getTime())) return { activo: false, motivo: "fecha no válida" };
    return h > ahora ? { activo: true, motivo: "hasta las " + fmtFecha(pr.hasta) } : { activo: false, motivo: "terminó el " + fmtFecha(pr.hasta) };
  }
  if (pr.tipo === "ventana") {
    const d = new Date(pr.desde || ""), h = new Date(pr.hasta || "");
    if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime())) return { activo: false, motivo: "fecha no válida" };
    if (ahora < d) return { activo: false, motivo: "empieza el " + fmtFecha(pr.desde) };
    if (ahora >= h) return { activo: false, motivo: "terminó el " + fmtFecha(pr.hasta) };
    return { activo: true, motivo: "hasta las " + fmtFecha(pr.hasta) };
  }
  if (pr.tipo === "franjas") {
    const p = madridPartes(ahora);
    const f = (pr.franjas || []).find((x) => franjaActiva(x, p));
    return f ? { activo: true, motivo: "franja de " + f.desde + " a " + f.hasta } : { activo: false, motivo: "fuera de franja" };
  }
  return { activo: false, motivo: "sin programación" };
}

function nombreDias(dias: number[]): string {
  const s = [...dias].sort();
  if (s.length === 7) return "todos los días";
  if (s.join() === "1,2,3,4,5") return "de lunes a viernes";
  if (s.join() === "1,2,3,4,5,6") return "de lunes a sábado";
  if (s.join() === "6,7") return "sábado y domingo";
  return s.map((d) => DIAS_N[d]).join(", ");
}

export function describir(pr: Programacion | undefined): string {
  if (!pr) return "Sin programación";
  if (pr.tipo === "siempre") return "Siempre, hasta que lo apagues (dentro del horario del bot)";
  if (pr.tipo === "apagado") return "Parado";
  if (pr.tipo === "hasta") return "Desde ahora hasta el " + fmtFecha(pr.hasta);
  if (pr.tipo === "ventana") return "Del " + fmtFecha(pr.desde) + " al " + fmtFecha(pr.hasta);
  if (pr.tipo === "franjas") {
    const t = (pr.franjas || []).map((f) => nombreDias(f.dias || []) + (f.desde === "00:00" && f.hasta === "00:00" ? ", todo el día" : " de " + f.desde + " a " + f.hasta + (f.desde > f.hasta && f.hasta !== "00:00" ? " (cruza la medianoche)" : ""))).join("; ");
    return t || "Sin franjas";
  }
  return "Sin programación";
}

/** Si alguna parte de la programación cae fuera del horario en que el bot actúa de verdad (8:30 a 21:00, Madrid). */
export function caeFueraDeHorario(pr: Programacion | undefined, ahora: Date): boolean {
  if (!pr || pr.tipo === "siempre" || pr.tipo === "apagado") return false;
  const dentro = (hm: string) => hm >= HORARIO_BOT.desde && hm < HORARIO_BOT.hasta;
  if (pr.tipo === "franjas") {
    return (pr.franjas || []).some((f) => esHora(f.desde) && esHora(f.hasta) && (f.desde !== f.hasta || f.desde === "00:00") && (f.desde < HORARIO_BOT.desde || f.hasta > HORARIO_BOT.hasta || f.hasta === "00:00" || f.desde > f.hasta));
  }
  const ini = pr.tipo === "ventana" ? new Date(pr.desde || "") : ahora;
  const fin = new Date(pr.hasta || "");
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime()) || fin <= ini) return false;
  const tope = Math.min(fin.getTime(), ini.getTime() + 8 * 864e5);
  for (let t = ini.getTime(); t < tope; t += 10 * 60000) {
    if (!dentro(madridPartes(new Date(t)).hm)) return true;
  }
  return false;
}

/** La programación guardada sigue sirviendo si se vuelve a encender (no es apagado ni una ventana ya terminada). */
export function sigueVigente(pr: Programacion | undefined, ahora: Date): boolean {
  if (!pr || pr.tipo === "apagado") return false;
  if (pr.tipo === "hasta") return new Date(pr.hasta || "") > ahora;
  if (pr.tipo === "ventana") return new Date(pr.hasta || "") > ahora;
  if (pr.tipo === "franjas") return (pr.franjas || []).some((f) => (f.dias || []).length && esHora(f.desde) && esHora(f.hasta) && (f.desde !== f.hasta || f.desde === "00:00"));
  return true;
}
