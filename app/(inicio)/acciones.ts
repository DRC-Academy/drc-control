"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { verificarSesion } from "@/lib/sesion";
import { leerJson } from "@/lib/github";
import { guardarControl, describeCambio, CONTROL_DEFECTO, type Control } from "@/lib/control";
import { sigueVigente } from "@/lib/programacion";
import { esRapido, programacionRapida, PROGRAMACION_DEFECTO } from "@/lib/rapidos";

async function exigirMandos(): Promise<void> {
  const c = await cookies();
  const s = await verificarSesion(c.get("drc_sesion")?.value);
  if (!s) redirect("/entrar");
  if (s.rol !== "mandos") redirect("/?error=" + encodeURIComponent("Solo quien entra con la clave de mandos puede cambiar esto."));
}

function fallo(msg: string): never {
  redirect("/?error=" + encodeURIComponent(msg));
}

/**
 * El interruptor y los atajos de la pantalla principal. Usan lo que ya está guardado (grupo, fase tope y reglas); la
 * programación solo la cambian los atajos. Encender (y los atajos, que también encienden) exige confirmación: la casilla
 * "confirmo" la rellena el navegador después de que la persona acepte el aviso, así que sin esa respuesta no se enciende.
 */
export async function cambiarEstado(formData: FormData): Promise<void> {
  await exigirMandos();
  const accion = String(formData.get("accion") || "");
  const ahora = new Date();
  const enciende = accion === "encender" || esRapido(accion);
  if (!enciende && accion !== "apagar" && accion !== "reactivar") fallo("Acción no válida.");
  if (enciende && formData.get("confirmo") !== "on") fallo("Hace falta confirmar para encender las respuestas automáticas.");

  const actual = (await leerJson<Control>("control.json"))?.data ?? null;
  const base: Control = JSON.parse(JSON.stringify(actual || CONTROL_DEFECTO));
  const nuevo: Control = { ...base };
  if (esRapido(accion)) {
    const r = programacionRapida(accion, ahora);
    if ("error" in r) fallo(r.error);
    nuevo.modo = "autonomo";
    nuevo.programacion = r.prog;
  } else if (accion === "encender") {
    nuevo.modo = "autonomo";
    if (!sigueVigente(base.programacion, ahora)) nuevo.programacion = PROGRAMACION_DEFECTO;
  } else {
    nuevo.modo = "propone";   // apagar las respuestas automáticas, o volver a encender un bot parado: solo sugerencias
  }

  const at = ahora.toISOString();
  nuevo.actualizado = { at, por: "mandos" };
  if (nuevo.modo === "autonomo") nuevo.autonomo_desde = actual?.modo === "autonomo" && actual.autonomo_desde ? actual.autonomo_desde : at;
  else delete nuevo.autonomo_desde;
  delete nuevo.nota;
  try {
    await guardarControl(nuevo, describeCambio(actual, nuevo), "mandos");
  } catch (e) {
    fallo("No se pudo guardar: " + (e as Error).message.slice(0, 160));
  }
  revalidateTag("control");
  redirect("/?ok=" + (enciende ? "encendido" : accion === "reactivar" ? "reactivado" : "apagado"));
}
