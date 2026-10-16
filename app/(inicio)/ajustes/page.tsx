import Link from "next/link";
import { cookies } from "next/headers";
import { verificarSesion } from "@/lib/sesion";
import { CONTROL_DEFECTO, FASES_TOPE_OPCIONES, REGLAS, leerEstadoPanel, resumen } from "@/lib/control";
import { NOMBRE } from "@/lib/analisis";
import { MAX_FRANJAS, HORARIO_BOT, activa, caeFueraDeHorario, describir } from "@/lib/programacion";
import { aDatetimeLocal, fmtFecha, madridPartes } from "@/lib/formato";
import { salir } from "@/app/acciones";
import BotonConfirmar from "@/components/BotonConfirmar";
import Flash from "@/components/Flash";
import { guardarAjustes, guardarCorreccionAccion, pararBot } from "./acciones";

export const dynamic = "force-dynamic";

const OK: Record<string, string> = {
  guardado: "Ajustes guardados. Si el bot está en marcha, los lee en su siguiente ronda.",
  correccion: "Corrección guardada. Pasa a las reglas del bot en su siguiente ronda.",
};
const DIA_CORTO = ["", "L", "M", "X", "J", "V", "S", "D"];
const TIPOS: [string, string][] = [
  ["franjas", "Horario semanal"], ["hasta", "Hasta una fecha"], ["ventana", "Entre dos fechas"], ["siempre", "Siempre"], ["apagado", "Parada"],
];

export default async function Ajustes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ck = await cookies();
  const ses = await verificarSesion(ck.get("drc_sesion")?.value);
  const mandos = ses?.rol === "mandos";
  const panel = await leerEstadoPanel();
  const c = panel.control || CONTROL_DEFECTO;
  const ap = panel.aplicado;
  const leido = !!(ap && panel.sha && ap.sha === panel.sha);
  const ahora = new Date();
  const pr = c.programacion || CONTROL_DEFECTO.programacion;
  const franjas = pr.franjas || [];
  const act = activa(pr, ahora);
  const dis = !mandos;
  const ok = typeof sp.ok === "string" ? OK[sp.ok] : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <>
      {ok && <Flash texto={ok} />}
      {error && <Flash texto={error} tono="mal" />}
      {panel.error && <div className="flash mal">No se puede leer el panel en GitHub: {panel.error}</div>}
      <div className="titulo-pag">
        <Link href="/" className="atras">← Inicio</Link>
        <h1>Ajustes</h1>
      </div>
      {!mandos && <p className="solo-vista">Has entrado con la clave de vista: puedes mirar, no cambiar.</p>}

      <form action={guardarAjustes} className="card" id="programacion">
        <h2>Programación</h2>
        <p className="linea">{describir(pr)}. <span className="suave">Ahora mismo (Madrid, {madridPartes(ahora).hm}): {act.activo ? "dentro, " + act.motivo : "fuera, " + act.motivo}.</span></p>
        <div className="prog sec">
          <div className="seg" role="radiogroup" aria-label="Tipo de programación">
            {TIPOS.map(([v, t]) => (
              <label key={v}><input type="radio" name="prog_tipo" value={v} defaultChecked={pr.tipo === v} disabled={dis} /><span>{t}</span></label>
            ))}
          </div>

          <div className="grupo g-franjas">
            <label className="campo">Atajo para los días de la primera franja
              <select name="atajo" defaultValue="" disabled={dis}>
                <option value="">Marcar los días a mano</option>
                <option value="todos">Todos los días</option>
                <option value="lv">De lunes a viernes</option>
                <option value="ls">De lunes a sábado</option>
                <option value="finde">Sábado y domingo</option>
              </select>
            </label>
            {Array.from({ length: MAX_FRANJAS }, (_, i) => {
              const f = franjas[i];
              const dias = f ? f.dias || [] : i === 0 && pr.tipo !== "franjas" ? [1, 2, 3, 4, 5, 6] : [];
              const campos = (
                <div className="sec" key={i}>
                  <div className="diasel">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <label key={d}><input type="checkbox" name={"f" + (i + 1) + "_dia_" + d} defaultChecked={dias.includes(d)} disabled={dis} /><span>{DIA_CORTO[d]}</span></label>
                    ))}
                  </div>
                  <div className="fila2">
                    <label className="campo">Desde<input type="time" name={"f" + (i + 1) + "_desde"} defaultValue={f ? f.desde : i === 0 ? HORARIO_BOT.desde : ""} disabled={dis} /></label>
                    <label className="campo">Hasta<input type="time" name={"f" + (i + 1) + "_hasta"} defaultValue={f ? f.hasta : i === 0 ? HORARIO_BOT.hasta : ""} disabled={dis} /></label>
                  </div>
                </div>
              );
              if (i === 0) return campos;
              return <details key={i} open={!!f}><summary>{i === 1 ? "Otra franja" : "Otra franja más"}</summary><div>{campos}</div></details>;
            })}
            <p className="suave">Para un tramo de noche pon el inicio más tarde que el fin (21:00 a 08:30). 00:00 como fin es el final del día y 00:00 a 00:00 el día entero.</p>
          </div>

          <div className="grupo g-hasta">
            <label className="campo">Desde ahora hasta<input type="datetime-local" name="prog_hasta" defaultValue={aDatetimeLocal(pr.tipo === "hasta" ? pr.hasta : undefined)} disabled={dis} /></label>
          </div>
          <div className="grupo g-ventana">
            <div className="fila2">
              <label className="campo">Desde<input type="datetime-local" name="ventana_desde" defaultValue={aDatetimeLocal(pr.tipo === "ventana" ? pr.desde : undefined)} disabled={dis} /></label>
              <label className="campo">Hasta<input type="datetime-local" name="ventana_hasta" defaultValue={aDatetimeLocal(pr.tipo === "ventana" ? pr.hasta : undefined)} disabled={dis} /></label>
            </div>
          </div>
          <p className="suave">Hora de Madrid. Fuera de la programación el bot vuelve a solo sugerir.</p>
          {caeFueraDeHorario(pr, ahora) && (
            <p className="prueba">Parte de esta programación cae fuera del horario en que el bot actúa ({HORARIO_BOT.desde} a {HORARIO_BOT.hasta}, Madrid): fuera de ese horario no hará nada aunque esté programado.</p>
          )}
        </div>

        <details open>
          <summary>A quién y hasta dónde</summary>
          <div>
            <p className="suave">Entran solo leads nuevos que llegan después de encender, por sorteo fijo según su id. El resto sigue como hoy, con sugerencias.</p>
            <p className="linea">{(FASES_TOPE_OPCIONES.find(([k]) => k === c.fase_tope) || ["", ""])[1]}.</p>
            <div className="fila2">
              <label className="campo">Fase tope
                <select name="fase_tope" defaultValue={c.fase_tope} disabled={dis}>
                  {FASES_TOPE_OPCIONES.map(([k]) => <option key={k} value={k}>{NOMBRE[k] || k}</option>)}
                </select>
              </label>
              <label className="campo">Leads nuevos en el grupo (%)
                <input type="number" name="grupo_pct" min={0} max={100} step={5} defaultValue={c.grupo_pct ?? 20} disabled={dis} />
              </label>
            </div>
          </div>
        </details>

        <details>
          <summary>Cuándo pasa la conversación a una persona</summary>
          <div>
            <p className="suave">En todos los casos el bot deja de responder en ese chat, escribe un comentario con el motivo y asigna el chat a Hugo.</p>
            <div className="reglas">
              {REGLAS.map(([k, t]) => (
                <label key={k}><input type="checkbox" name={"regla_" + k} defaultChecked={k === "fase_tope" ? true : !!(c.reglas || {})[k]} disabled={dis || k === "fase_tope"} /><span>{t}</span></label>
              ))}
            </div>
          </div>
        </details>

        <div className="sticky-guardar"><button type="submit" className="boton-suave primario" disabled={dis}>Guardar ajustes</button></div>
      </form>

      <form action={guardarCorreccionAccion} className="card">
        <h2>Corregir al bot</h2>
        <p className="suave">Una regla general. La corrección de un chat concreto sigue siendo un comentario «Correccion Diego: ...» dentro de ese chat en Respond.</p>
        <textarea name="texto" rows={3} placeholder="Ejemplo: no ofrecer el mensual si el lead no lo pide" disabled={dis} />
        <div><button type="submit" className="boton-suave" disabled={dis}>Guardar corrección</button></div>
        {panel.correcciones.items.length > 0 && (
          <details>
            <summary>Últimas correcciones</summary>
            <div className="hist">
              {panel.correcciones.items.slice().reverse().slice(0, 15).map((i) => (
                <div key={i.id}>{i.estado === "aplicada" ? "Aplicada" : "Pendiente"} · {fmtFecha(i.at)}: {i.texto}</div>
              ))}
            </div>
          </details>
        )}
      </form>

      <section className="card">
        <h2>Estado</h2>
        <details>
          <summary>Lo que pide el panel y lo que ha leído el bot</summary>
          <div>
            <p className="linea">{resumen(panel.control)}</p>
            <p className="suave">
              {ap ? (leido ? "El bot ha leído esta versión el " + fmtFecha(ap.leido_en) + "." : "El bot tiene una versión anterior, leída el " + fmtFecha(ap.leido_en) + ".") + (ap.modo_efectivo ? " Modo efectivo: " + ap.modo_efectivo + "." : "") : "El bot no ha dejado acuse todavía."}
              {" "}{ap?.autonomo_disponible ? "Envío real: activado en el bot." : "Envío real: bloqueado por el interruptor de seguridad del bot (modo prueba)."}
            </p>
            {ap?.parada && <p className="prueba">Parada automática del modo autónomo{ap.parada.motivo ? ": " + ap.parada.motivo : ""}. Se levanta al guardar los ajustes otra vez.</p>}
          </div>
        </details>
        <details>
          <summary>Historial de cambios</summary>
          <div className="hist">
            {panel.historial.items.length
              ? panel.historial.items.slice().reverse().slice(0, 30).map((i, k) => <div key={k}>{fmtFecha(i.at)} · {i.por} · {i.cambio}</div>)
              : <p className="suave">Sin cambios guardados todavía.</p>}
          </div>
        </details>
      </section>

      <section className="card">
        <h2>Más análisis</h2>
        <div className="enlaces">
          <Link href="/salud">Salud, día a día</Link>
          <Link href="/preparacion">Preparación por fase</Link>
          <Link href="/grupo">Grupo de control</Link>
          <Link href="/auditoria">Auditoría</Link>
          <Link href="/comparar">Comparar periodos</Link>
        </div>
      </section>

      <section className="card">
        <h2>Apagar el bot</h2>
        <p className="suave">Ni sugiere respuestas ni responde. Se vuelve a encender desde la pantalla principal.</p>
        <form action={pararBot}>
          <input type="hidden" name="confirmo" defaultValue="" />
          <BotonConfirmar type="submit" className="boton-suave peligro" mensaje="¿Apagar el bot por completo? Dejará de sugerir respuestas y de responder." disabled={dis}>Apagar el bot por completo</BotonConfirmar>
        </form>
      </section>

      <form action={salir} className="pie">
        <span>{mandos ? "Con mandos" : "Solo vista"}</span>
        <button type="submit">Salir</button>
      </form>
    </>
  );
}
