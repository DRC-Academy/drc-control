// Carga única por página: filas de ventas, alumnos y estado del panel, con el error a la vista si falta algo.
import "server-only";
import { filasVentas, type Fila } from "./datos";
import { leerAlumnos } from "./respond";
import type { EstadoRespond } from "./sinVentas";
import { leerEstadoPanel, type EstadoPanel } from "./control";

export type Carga = { filas: Fila[]; alumnos: Set<number>; respond: EstadoRespond; panel: EstadoPanel; error: string | null };

export async function cargar(): Promise<Carga> {
  const panel = await leerEstadoPanel();
  try {
    const [filas, al] = await Promise.all([filasVentas(), leerAlumnos()]);
    return { filas, alumnos: new Set(al.ids), respond: al.estado, panel, error: null };
  } catch (e) {
    return { filas: [], alumnos: new Set<number>(), respond: { token: !!process.env.RESPONDIO_TOKEN, error: null }, panel, error: (e as Error).message };
  }
}
