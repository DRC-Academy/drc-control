// Carga única por página: filas de ventas, alumnos y estado del panel, con el error a la vista si falta algo.
import "server-only";
import { filasVentas, type Fila } from "./datos";
import { leerAlumnos } from "./respond";
import { leerEstadoPanel, type EstadoPanel } from "./control";

export type Carga = { filas: Fila[]; alumnos: Set<number>; panel: EstadoPanel; error: string | null };

export async function cargar(): Promise<Carga> {
  const panel = await leerEstadoPanel();
  try {
    const [filas, alumnos] = await Promise.all([filasVentas(), leerAlumnos()]);
    return { filas, alumnos: new Set(alumnos), panel, error: null };
  } catch (e) {
    return { filas: [], alumnos: new Set<number>(), panel, error: (e as Error).message };
  }
}
