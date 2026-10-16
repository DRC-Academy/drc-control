// Atajos de la pantalla principal: encender durante un rato. Sin dependencias de Next: se prueba suelto.
import { HORARIO_BOT, type Programacion } from "./programacion";
import { madridEn, madridPartes } from "./formato";

export const RAPIDOS = ["r1h", "r2h", "r4h", "rhoy", "rfinde"] as const;
export type Rapido = (typeof RAPIDOS)[number];

export const ETIQUETA_RAPIDO: Record<Rapido, string> = {
  r1h: "1 hora", r2h: "2 horas", r4h: "4 horas", rhoy: "Hoy", rfinde: "Fin de semana",
};

// Cuando se enciende sin elegir nada y no queda una programación que sirva: todos los días en el horario del bot.
export const PROGRAMACION_DEFECTO: Programacion = {
  tipo: "franjas",
  franjas: [{ dias: [1, 2, 3, 4, 5, 6, 7], desde: HORARIO_BOT.desde, hasta: HORARIO_BOT.hasta }],
  zona: "Europe/Madrid",
};

export function esRapido(s: string): s is Rapido {
  return (RAPIDOS as readonly string[]).includes(s);
}

/** La programación de un atajo, o el motivo por el que no se puede (por ejemplo, "hoy" después de las 21:00). */
export function programacionRapida(accion: Rapido, ahora: Date): { prog: Programacion } | { error: string } {
  if (accion === "r1h" || accion === "r2h" || accion === "r4h") {
    const horas = Number(accion[1]);
    return { prog: { tipo: "hasta", hasta: new Date(ahora.getTime() + horas * 3600e3).toISOString(), zona: "Europe/Madrid", q: accion.slice(1) } };
  }
  if (accion === "rhoy") {
    const o = madridPartes(ahora);
    const fin = madridEn(o.y, o.m, o.d, 21, 0);
    if (fin <= ahora) return { error: "Ya pasaron las 21:00 de hoy: el bot ya no actúa hasta mañana." };
    return { prog: { tipo: "hasta", hasta: fin.toISOString(), zona: "Europe/Madrid", q: "hoy" } };
  }
  return { prog: { tipo: "franjas", franjas: [{ dias: [6, 7], desde: "00:00", hasta: "00:00" }], zona: "Europe/Madrid" } };
}
