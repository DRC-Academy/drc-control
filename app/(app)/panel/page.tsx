import { cookies } from "next/headers";
import { cargar } from "@/lib/cargar";
import { verificarSesion } from "@/lib/sesion";
import { CONTROL_DEFECTO, REGLAS, programada, resumen, describeProg } from "@/lib/control";
import { MAX_FRANJAS, HORARIO_BOT, caeFueraDeHorario } from "@/lib/programacion";
import { maxFecha } from "@/lib/analisis";
import { DIAS_N, fmtFecha, madridPartes, aDatetimeLocal } from "@/lib/formato";
import Pildoras from "@/components/Pildoras";
import Aviso from "@/components/Aviso";
import Chip from "@/components/Chip";
import { guardarPanel, guardarCorreccionAccion } from "./acciones";

export const dynamic = "force-dynamic";

const OK: Record<string, string> = {
  encendido: "Respuestas automáticas encendidas en el panel. El bot lo lee en su siguiente evento o ronda.",
  apagado: "Respuestas automáticas apagadas: el bot vuelve a solo sugerir la respuesta.",
  parado: "Bot apagado por completo: ni sugiere ni responde.",
  guardado: "Cambios guardados. El estado (encendido o apagado) no ha cambiado.",
  correccion: "Corrección guardada. Queda pendiente hasta que el bot la lleve a sus aprendizajes.",
};

export default async function Panel({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ck = await cookies();
  const s = await verificarSesion(ck.get("drc_sesion")?.value);
  const mandos = s?.rol === "mandos";
  const { filas, panel } = await cargar();
  const c = panel.control || CONTROL_DEFECTO;
  const ahora = new Date();
  const pa = programada(c, ahora);
  const m = madridPartes(ahora);
  const ap = panel.aplicado;
  const leido = !!(ap && panel.sha && ap.sha === panel.sha);
  const pr = c.programacion || { tipo: "franjas" as const, zona: "Europe/Madrid" as const };
  const franjas = pr.franjas || [];
  const ok = typeof sp.ok === "string" ? sp.ok : "";
  const error = typeof sp.error === "string" ? sp.error : "";
  const dis = !mandos;
  const encendido = c.modo === "autonomo";
  const envioReal = ap?.autonomo_disponible;
  const tono = c.modo === "apagado" ? "mal" : encendido ? (envioReal ? "" : "aviso") : "neutro";
  const fuera = caeFueraDeHorario(pr, ahora);

  return (
    <>
      <Pildoras control={panel.control} aplicado={panel.aplicado} sha={panel.sha} maxFecha={maxFecha(filas)} />
      {panel.error && <Aviso tono="mal" texto={"No se ha podido leer el panel en GitHub: " + panel.error} />}
      {OK[ok] && <Aviso texto={OK[ok] + (ok === "encendido" && envioReal !== true ? " Recuerda: con el interruptor de seguridad del bot en prueba no se envía nada; solo se deja el comentario Habría enviado." : "")} />}
      {error && <Aviso tono="mal" texto={error} />}
      {!mandos && <Aviso tono="aviso" texto="Has entrado con la clave de vista: puedes mirar el panel, no cambiarlo." />}
      {ap?.parada && <Aviso tono="mal" texto={"Parada automática del modo autónomo" + (ap.parada.motivo ? ": " + ap.parada.motivo : "") + ". Se levanta al guardar el panel otra vez."} />}

      <form action={guardarPanel} className="pagina">
        <div className="tarjeta" id="respuestas-automaticas">
          <div><h2>Respuestas automáticas</h2></div>
          <div className={"estado" + (tono ? " " + tono : "")}>
            <i />
            <div>
              <span className="grande">{c.modo === "apagado" ? "BOT APAGADO" : encendido ? "ENCENDIDAS" : "APAGADAS"}</span>
              <p className="sub">
                {c.modo === "apagado"
                  ? "Ni sugiere ni responde."
                  : encendido
                    ? "El bot contestará solo al " + (c.grupo_pct ?? 0) + " % de los leads nuevos, hasta " + (c.fase_tope === "precio" ? "el precio" : "la explicación") + ", y luego pasa el chat a una persona. " + describeProg(c) + ". Ahora mismo: " + (pa.activo ? "ACTIVO (" + pa.motivo + ")." : "fuera de programación (" + pa.motivo + "), solo sugiere.")
                    : "El bot solo sugiere la respuesta y una persona la envía, como hoy."}
              </p>
            </div>
          </div>
          <p className="nota">
            {!ap
              ? "El bot todavía no ha dejado acuse, así que no se sabe si el envío real está permitido."
              : envioReal
                ? "Envío real: ACTIVADO en el bot. Si enciendes las respuestas automáticas, el bot enviará mensajes de verdad."
                : "Envío real: BLOQUEADO. Hay un interruptor de seguridad en el bot (COPILOTO_AUTONOMO) que solo se pone en activo en GitHub, por decisión de Diego. Mientras esté en prueba, aunque enciendas las respuestas, el bot no envía nada: solo deja el comentario Habría enviado."}
            {leido ? "" : " El bot aún no ha leído la última versión del panel."}
          </p>
          <div className="acciones">
            <button type="submit" name="accion" value="encender" className="primario" disabled={dis}>Encender respuestas automáticas</button>
            <button type="submit" name="accion" value="apagar" disabled={dis}>Apagar respuestas automáticas</button>
          </div>
          <label className="opciones"><span style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" name="confirmo" disabled={dis} style={{ marginTop: 4 }} /><span>Confirmo el cambio. Hace falta para encender, y para apagar el bot por completo. Encender usa la programación, el grupo y la fase tope de más abajo, tal como están escritos ahora en esta página.</span></span></label>
          <div>
            <p className="nota">O enciende solo durante un rato (misma casilla de confirmación):</p>
            <div className="rapidos">
              <button type="submit" name="accion" value="r1h" disabled={dis}>La próxima hora</button>
              <button type="submit" name="accion" value="r2h" disabled={dis}>2 horas</button>
              <button type="submit" name="accion" value="r4h" disabled={dis}>4 horas</button>
              <button type="submit" name="accion" value="rhoy" disabled={dis}>Hasta las 21:00 de hoy</button>
              <button type="submit" name="accion" value="rfinde" disabled={dis}>Fin de semana entero</button>
            </div>
          </div>
          <div className="acciones">
            <button type="submit" name="accion" value="apagado_total" className="peligro" disabled={dis}>Apagar el bot por completo (ni sugiere respuestas)</button>
          </div>
        </div>

        <div className="tarjeta">
          <div><h2>Cuándo responde solo</h2><p className="nota">Hora de Madrid. Fuera de la programación el bot vuelve a solo sugerir. Elige un tipo y rellena solo sus campos.</p></div>
          <div className="ctl">
            <label>Tipo de programación
              <select name="prog_tipo" defaultValue={pr.tipo} disabled={dis}>
                <option value="franjas">Horario por días: todos los días o días concretos, de una hora a otra</option>
                <option value="ventana">Entre dos fechas: desde un día y hora hasta otro día y hora</option>
                <option value="hasta">Desde ahora hasta una fecha y hora</option>
                <option value="siempre">Siempre, hasta que lo apague</option>
                <option value="apagado">Parada: no responde nunca</option>
              </select>
            </label>
          </div>
          <h3>Entre dos fechas</h3>
          <div className="ctl">
            <label>Desde (día y hora)<input type="datetime-local" name="ventana_desde" defaultValue={aDatetimeLocal(pr.tipo === "ventana" ? pr.desde : undefined)} disabled={dis} /></label>
            <label>Hasta (día y hora)<input type="datetime-local" name="ventana_hasta" defaultValue={aDatetimeLocal(pr.tipo === "ventana" ? pr.hasta : undefined)} disabled={dis} /></label>
          </div>
          <h3>Desde ahora hasta</h3>
          <div className="ctl">
            <label>Hasta (día y hora)<input type="datetime-local" name="prog_hasta" defaultValue={aDatetimeLocal(pr.tipo === "hasta" ? pr.hasta : undefined)} disabled={dis} /></label>
          </div>
          <h3>Horario por días (hasta {MAX_FRANJAS} franjas)</h3>
          <div className="ctl">
            <label>Atajo para los días de la franja 1
              <select name="atajo" defaultValue="" disabled={dis}>
                <option value="">Marcar los días a mano</option>
                <option value="todos">Todos los días</option>
                <option value="lv">De lunes a viernes</option>
                <option value="ls">De lunes a sábado</option>
                <option value="finde">Sábado y domingo</option>
              </select>
            </label>
          </div>
          {[0, 1, 2].map((i) => {
            const f = franjas[i];
            const dias = f ? f.dias || [] : i === 0 && pr.tipo !== "franjas" ? [1, 2, 3, 4, 5, 6] : [];
            return (
              <div className="franja" key={i}>
                <strong>{i === 0 ? "Franja 1" : "Franja " + (i + 1) + " (opcional)"}</strong>
                <div className="dias">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => <label key={d}><input type="checkbox" name={"f" + (i + 1) + "_dia_" + d} defaultChecked={dias.includes(d)} disabled={dis} />{DIAS_N[d]}</label>)}
                </div>
                <div className="ctl">
                  <label>Desde<input type="time" name={"f" + (i + 1) + "_desde"} defaultValue={f ? f.desde : i === 0 ? HORARIO_BOT.desde : ""} disabled={dis} /></label>
                  <label>Hasta<input type="time" name={"f" + (i + 1) + "_hasta"} defaultValue={f ? f.hasta : i === 0 ? HORARIO_BOT.hasta : ""} disabled={dis} /></label>
                </div>
              </div>
            );
          })}
          <p className="nota">Para un tramo de noche, pon el inicio más tarde que el fin (por ejemplo de 21:00 a 08:30). 00:00 como fin es el final del día, y 00:00 a 00:00 es el día entero. Deja vacías las franjas que no uses.</p>
          {fuera && <Aviso tono="aviso" texto={"Parte de la programación guardada cae fuera del horario en que el bot actúa hoy (" + HORARIO_BOT.desde + " a " + HORARIO_BOT.hasta + ", hora de Madrid): fuera de ese horario no hará nada aunque esté programado. Ampliar ese horario es un cambio aparte en el bot y en el relevo de Cloudflare."} />}
          <p className="nota">Ahora mismo (Madrid, {m.hm}): con lo guardado, las respuestas automáticas están {pa.activo ? "ACTIVAS (" + pa.motivo + ")" : "inactivas (" + pa.motivo + ")"}.</p>
        </div>

        <div className="tarjeta">
          <div><h2>A quién y hasta dónde</h2><p className="nota">Entran solo leads nuevos que llegan después de encender, por sorteo fijo según su id: nadie elige quién entra. El resto sigue como hoy, con sugerencias.</p></div>
          <div className="ctl">
            <label>Fase tope
              <select name="fase_tope" defaultValue={c.fase_tope} disabled={dis}>
                <option value="explicacion">Explicación (el precio lo da una persona)</option>
                <option value="precio">Precio (el bot da el precio y luego entra una persona)</option>
              </select>
            </label>
            <label>Grupo de control: % de los leads nuevos<input type="number" name="grupo_pct" min={0} max={100} step={5} defaultValue={c.grupo_pct ?? 20} disabled={dis} /></label>
          </div>
        </div>

        <div className="tarjeta">
          <div><h2>Cuándo pasa la conversación a una persona</h2><p className="nota">En todos los casos el bot deja de responder en ese chat, escribe un comentario con el motivo mencionando a ventas, y asigna el chat a Hugo.</p></div>
          <div className="opciones">
            {REGLAS.map(([k, t]) => <label key={k}><input type="checkbox" name={"regla_" + k} defaultChecked={k === "fase_tope" ? true : !!(c.reglas || {})[k]} disabled={dis || k === "fase_tope"} /><span>{t}</span></label>)}
          </div>
          <div className="acciones"><button type="submit" name="accion" value="guardar" className="primario" disabled={dis}>Guardar cambios sin cambiar el estado</button><span className="nota">Guarda la programación, el grupo y las reglas, pero no enciende ni apaga.</span></div>
        </div>
      </form>

      <div className="tarjeta">
        <div><h2>Lo que pide el panel y lo que ha leído el bot</h2></div>
        <div className="rejilla2">
          <div><h3>Lo que pide el panel</h3><p className="sub">{resumen(panel.control)}</p></div>
          <div><h3>Lo que ha leído el bot</h3><p className="sub">{ap ? (leido ? "Esta versión, el " + fmtFecha(ap.leido_en) + ". " : "Una versión anterior, el " + fmtFecha(ap.leido_en) + ". ") + (ap.modo_efectivo ? "Modo efectivo: " + ap.modo_efectivo + "." : "") : "El bot no ha dejado acuse todavía."}</p></div>
        </div>
        <p className="nota">El panel escribe control.json en la rama estado del repositorio del bot. El bot lo lee en cada mensaje y en cada ronda y deja su acuse en control-aplicado.json.</p>
      </div>

      <form action={guardarCorreccionAccion} className="tarjeta">
        <div><h2>Corregir al bot</h2><p className="nota">Una regla o corrección general. La corrección de un chat concreto sigue siendo un comentario "Correccion Diego: ..." dentro de ese chat en Respond. Lo que se escribe aquí pasa a las reglas de Diego del bot en su siguiente ronda.</p></div>
        <textarea name="texto" rows={3} placeholder="Ejemplo: no ofrecer el mensual si el lead no lo pide" disabled={dis} />
        <div className="acciones"><button type="submit" disabled={dis}>Guardar corrección</button></div>
        <div className="hist">
          {panel.correcciones.items.length ? panel.correcciones.items.slice().reverse().slice(0, 20).map((i) => <div key={i.id}><Chip texto={i.estado === "aplicada" ? "Aplicada" : "Pendiente"} tono={i.estado === "aplicada" ? "ok" : "aviso"} /> {fmtFecha(i.at)}: {i.texto}</div>) : <p className="nota">Sin correcciones guardadas.</p>}
        </div>
      </form>
      <div className="tarjeta">
        <div><h2>Historial del panel</h2></div>
        <div className="hist">
          {panel.historial.items.length ? panel.historial.items.slice().reverse().slice(0, 30).map((i, idx) => <div key={idx}>{fmtFecha(i.at)} · {i.por} · {i.cambio}</div>) : <p className="nota">Sin cambios guardados todavía.</p>}
        </div>
      </div>
    </>
  );
}
