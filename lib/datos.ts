// Las métricas del bot: una línea por propuesta cerrada en metricas/AAAA-MM-DD.jsonl de la rama estado.
// Cada archivo se cachea por su sha (los días pasados no cambian); la lista del directorio, 5 minutos.
import "server-only";
import { unstable_cache } from "next/cache";
import { listarDir, leerTexto } from "./github";
import { addDias, hoyIso } from "./formato";

export type Fila = {
  fecha: string;
  contact_id: number;
  estado: string;
  area: string;
  tipo: string;
  etapa: string;
  origen: string;
  tarde: boolean;
  latencia_s: number | null;
  respuesta_s: number | null;
  clase: string;
  grupo: string;
  enviada_por: string;
  traspaso: string;
  hora: string;
};

export const DIAS_METRICAS = 90;

function texto(v: unknown): string {
  return v == null ? "" : String(v);
}
function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function normalizar(r: Record<string, unknown>): Fila {
  return {
    fecha: texto(r.fecha).slice(0, 10),
    contact_id: Number(r.contact_id) || 0,
    estado: texto(r.estado),
    area: texto(r.area),
    tipo: texto(r.tipo),
    etapa: texto(r.etapa),
    origen: texto(r.origen),
    tarde: Boolean(r.tarde),
    latencia_s: numero(r.latencia_s),
    respuesta_s: numero(r.respuesta_s),
    clase: texto(r.clase),
    grupo: texto(r.grupo),
    enviada_por: texto(r.enviada_por),
    traspaso: texto(r.traspaso),
    hora: texto(r.hora),
  };
}

const listar = unstable_cache(async () => listarDir("metricas"), ["metricas-dir"], { revalidate: 300, tags: ["metricas"] });

function leerArchivo(name: string, sha: string): Promise<Fila[]> {
  return unstable_cache(
    async () => {
      const t = await leerTexto("metricas/" + name);
      const out: Fila[] = [];
      (t || "").split("\n").forEach((l) => {
        const s = l.trim();
        if (!s) return;
        try {
          out.push(normalizar(JSON.parse(s) as Record<string, unknown>));
        } catch {
          /* línea rota: se ignora */
        }
      });
      return out;
    },
    ["metrica", name, sha],
    { revalidate: 86400, tags: ["metricas"] },
  )();
}

export async function leerFilas(): Promise<Fila[]> {
  const dir = await listar();
  const desde = addDias(hoyIso(), -DIAS_METRICAS);
  const sel = dir
    .filter((a) => a.name.endsWith(".jsonl") && a.name.slice(0, 10) >= desde)
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  const partes: Fila[][] = [];
  for (let i = 0; i < sel.length; i += 8) {
    const trozo = sel.slice(i, i + 8);
    partes.push(...(await Promise.all(trozo.map((a) => leerArchivo(a.name, a.sha)))));
  }
  return partes.flat();
}

export async function filasVentas(): Promise<Fila[]> {
  return (await leerFilas()).filter((r) => r.area === "ventas");
}
