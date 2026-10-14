import { cookies } from "next/headers";
import { cargar } from "@/lib/cargar";
import { verificarSesion } from "@/lib/sesion";
import { CONTROL_DEFECTO, REGLAS, programada, resumen } from "@/lib/control";
import { maxFecha } from "@/lib/analisis";
import { DIAS_N, fmtFecha, madridPartes, aDatetimeLocal } from "@/lib/formato";
import Pildoras from "@/components/Pildoras";
import Aviso from "@/components/Aviso";
import Chip from "@/components/Chip";
import { guardarPanel, guardarCorreccionAccion } from "./acciones";

export const dynamic = "force-dynamic";

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
  const leido = !!(panel.aplicado && panel.sha && panel.aplicado.sha === panel.sha);
  const pr = c.programacion || { tipo: "franjas" as const, zona: "Europe/Madrid" as const };
  const franja = (pr.franjas || [])[0] || { dias: [1, 2, 3, 4, 5, 6], desde: "08:30", hasta: "21:00" };
  const ok = typeof sp.ok === "string" ? sp.ok : "";
  const error = typeof sp.error === "string" ? sp.error : "";
  const dis = !mandos;
  return (
    <>
      <Pildoras control={panel.control} aplicado={panel.aplicado} sha={panel.sha} maxFecha={maxFecha(filas)} />
      {panel.error && <Aviso tono="mal" texto={"No se ha podido leer el panel en GitHub: " + panel.error} />}
      {ok === "1" && <Aviso texto="Guardado en control.json. El bot lo lee en su siguiente evento o ronda." />}
      {ok === "2" && <Aviso texto="Corrección guardada. Queda pendiente hasta que Claude la lleve a los aprendizajes del bot." />}
      {error && <Aviso tono="mal" texto={error} />}
      {!mandos && <Aviso tono="aviso" texto="Has entrado con la clave de vista: puedes mirar el panel, no cambiarlo." />}
      <div className="tarjeta">
        <div><h2>Estado del panel</h2></div>
        <div className="rejilla2">
          <div><h3>Lo que pide el panel</h3><p className="sub">{resumen(panel.control)}</p></div>
          <div><h3>Lo que ha leído el bot</h3><p className="sub">{panel.aplicado ? (leido ? "Esta versión, el " + fmtFecha(panel.aplicado.leido_en) + ". " : "Una versión anterior, el " + fmtFecha(panel.aplicado.leido_en) + ". ") + (panel.aplicado.autonomo_disponible ? "El modo autónomo está disponible en el bot." : "El modo autónomo no está disponible en el bot todavía (falta construirlo o encender COPILOTO_AUTONOMO).") : "El bot no ha dejado acuse todavía: el modo autónomo no existe aún en el bot o nunca ha leído control.json."}</p></div>
        </div>
        <p className="nota">El panel escribe control.json en la rama estado del repositorio del bot. El bot lo lee en cada mensaje y en cada ronda y deja un acuse en control-aplicado.json. Mientras el modo autónomo no esté construido en el bot, lo que se guarda aquí es la orden que Claude aplicará.</p>
      </div>
      <form action={guardarPanel} className="tarjeta">
        <div><h2>Modo del bot</h2></div>
        <div className="opciones">
          <label><input type="radio" name="modo" value="propone" defaultChecked={c.modo === "propone"} disabled={dis} /><span><b>Propone.</b> El bot sugiere la respuesta como comentario y una persona la envía. Es como funciona hoy.</span></label>
          <label><input type="radio" name="modo" value="autonomo" defaultChecked={c.modo === "autonomo"} disabled={dis} /><span><b>Responde solo al grupo de control.</b> A los leads nuevos del grupo les contesta el bot directamente hasta la fase tope y luego entra una persona. El resto sigue en modo propone.</span></label>
          <label><input type="radio" name="modo" value="apagado" defaultChecked={c.modo === "apagado"} disabled={dis} /><span><b>Apagado.</b> Ni propone ni responde.</span></label>
        </div>
        <div className="ctl">
          <label>Fase tope del modo autónomo
            <select name="fase_tope" defaultValue={c.fase_tope} disabled={dis}>
              <option value="explicacion">Explicación (el precio lo da una persona)</option>
              <option value="precio">Precio (el bot da el precio y luego entra una persona)</option>
            </select>
          </label>
          <label>Grupo de control: % de los leads nuevos<input type="number" name="grupo_pct" min={0} max={100} step={5} defaultValue={c.grupo_pct ?? 20} disabled={dis} /></label>
        </div>
        <div><h2>Cuándo responde solo</h2><p className="nota">Fuera de estos tramos el bot vuelve a proponer. Horas de Madrid. Los botones rápidos guardan al momento y ponen el modo en "responde solo".</p></div>
        <div className="rapidos">
          <button type="submit" name="rapido" value="1h" disabled={dis}>Próxima hora</button>
          <button type="submit" name="rapido" value="2h" disabled={dis}>2 horas</button>
          <button type="submit" name="rapido" value="4h" disabled={dis}>4 horas</button>
          <button type="submit" name="rapido" value="hoy" disabled={dis}>Hasta las 21:00 de hoy</button>
          <button type="submit" name="rapido" value="finde" disabled={dis}>Fin de semana</button>
          <button type="submit" name="rapido" value="siempre" disabled={dis}>Siempre</button>
          <button type="submit" name="rapido" value="off" className="peligro" disabled={dis}>Parar el modo autónomo</button>
        </div>
        <div className="ctl">
          <label>Programación
            <select name="prog_tipo" defaultValue={pr.tipo} disabled={dis}>
              <option value="franjas">Horario fijo (días y horas)</option><option value="hasta">Hasta una fecha y hora</option><option value="siempre">Siempre</option><option value="apagado">Parado</option>
            </select>
          </label>
          <label>Hasta (si es "hasta una fecha y hora")<input type="datetime-local" name="prog_hasta" defaultValue={aDatetimeLocal(pr.hasta)} disabled={dis} /></label>
          <label>Horario fijo, desde<input type="time" name="franja_desde" defaultValue={franja.desde} disabled={dis} /></label>
          <label>hasta<input type="time" name="franja_hasta" defaultValue={franja.hasta} disabled={dis} /></label>
        </div>
        <div className="dias">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => <label key={d}><input type="checkbox" name={"dia_" + d} defaultChecked={(franja.dias || []).includes(d)} disabled={dis} />{DIAS_N[d]}</label>)}
        </div>
        <p className="nota">Ahora mismo (Madrid, {m.hm}): con lo guardado, el modo autónomo está {pa.activo ? "ACTIVO (" + pa.motivo + ")" : "inactivo (" + pa.motivo + ")"}.</p>
        <div><h2>Cuándo pasa la conversación a una persona</h2><p className="nota">En todos los casos el bot deja de responder en ese chat, escribe un comentario con el motivo mencionando a ventas, y asigna el chat a Hugo.</p></div>
        <div className="opciones">
          {REGLAS.map(([k, t]) => <label key={k}><input type="checkbox" name={"regla_" + k} defaultChecked={k === "fase_tope" ? true : !!(c.reglas || {})[k]} disabled={dis || k === "fase_tope"} /><span>{t}</span></label>)}
        </div>
        <div className="acciones"><button type="submit" className="primario" disabled={dis}>Guardar en el panel</button></div>
      </form>
      <form action={guardarCorreccionAccion} className="tarjeta">
        <div><h2>Corregir al bot</h2><p className="nota">Una regla o corrección general. La corrección de un chat concreto sigue siendo un comentario "Correccion Diego: ..." dentro de ese chat en Respond. Lo que se escribe aquí queda pendiente hasta que Claude lo lleve a los aprendizajes del bot.</p></div>
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
