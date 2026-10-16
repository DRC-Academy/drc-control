// Lectura del estado en vivo del bot (rama estado) para la pantalla principal. Solo servidor.
// No lee nunca propuestas/ (la memoria de los chats): solo salud/, vigilante.json y rescates.json.
import "server-only";
import { unstable_cache } from "next/cache";
import { leerJson, leerTexto } from "./github";
import { madridPartes } from "./formato";
import { calcularSalud, type EstadoRescates, type EstadoVigilante, type FilaSalud, type SaludBot } from "./estado";

const dos = (n: number) => String(n).padStart(2, "0");

function parsear(texto: string | null): FilaSalud[] {
  const salida: FilaSalud[] = [];
  (texto || "").split("\n").forEach((l) => {
    const s = l.trim();
    if (!s) return;
    try {
      const f = JSON.parse(s) as FilaSalud;
      if (typeof f.ts === "number" && typeof f.r === "string") salida.push(f);
    } catch {
      /* línea rota: se ignora */
    }
  });
  return salida;
}

function leerBrutos(dia: string) {
  return unstable_cache(
    async () => {
      const [filas, vig, res] = await Promise.all([
        leerTexto("salud/" + dia + ".jsonl"),
        leerJson<NonNullable<EstadoVigilante>>("vigilante.json"),
        leerJson<NonNullable<EstadoRescates>>("rescates.json"),
      ]);
      return { filas: parsear(filas), vigilante: vig?.data ?? null, rescates: res?.data ?? null };
    },
    ["salud-bot", dia],
    { revalidate: 30, tags: ["salud"] },
  )();
}

/** El estado del bot ahora. Si no se puede leer, lo dice: nunca da por bueno lo que no ha podido comprobar. */
export async function leerSaludBot(modo: "propone" | "autonomo" | "apagado" | null): Promise<SaludBot> {
  const ahora = new Date();
  const m = madridPartes(ahora);
  try {
    const b = await leerBrutos(m.y + "-" + dos(m.m) + "-" + dos(m.d));
    return calcularSalud({ ...b, modo, ahora });
  } catch (e) {
    return {
      nivel: "aviso", titulo: "No puedo comprobar el estado", esperando: 0, hoy: 0, ultima_s: null, lat_s: null,
      detalle: "No se ha podido leer lo que deja el bot en GitHub (" + (e as Error).message.slice(0, 80) + ").",
    };
  }
}
