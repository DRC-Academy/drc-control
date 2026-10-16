import Link from "next/link";
import { cookies } from "next/headers";
import { cargar } from "@/lib/cargar";
import { verificarSesion } from "@/lib/sesion";
import { leerSaludBot } from "@/lib/estadoServidor";
import { cierre, embudo, respuestaPersonas } from "@/lib/resumen";
import { CONTROL_DEFECTO, describeFase, describeProg, programada } from "@/lib/control";
import { RAPIDOS, ETIQUETA_RAPIDO, type Rapido } from "@/lib/rapidos";
import { HORARIO_BOT, caeFueraDeHorario } from "@/lib/programacion";
import { maxFecha } from "@/lib/analisis";
import { f0, f1, fmtDia, p0, p1, madridPartes } from "@/lib/formato";
import { refrescar } from "@/app/acciones";
import BotonConfirmar from "@/components/BotonConfirmar";
import AutoRefresco from "@/components/AutoRefresco";
import Flash from "@/components/Flash";
import { cambiarEstado } from "./acciones";

export const dynamic = "force-dynamic";

const OK: Record<string, string> = {
  encendido: "Respuestas automáticas encendidas.",
  apagado: "Respuestas automáticas apagadas. El bot solo sugiere.",
  reactivado: "Bot encendido: vuelve a sugerir respuestas.",
};

const DURACION: Record<Rapido, string> = {
  r1h: "durante 1 hora", r2h: "durante 2 horas", r4h: "durante 4 horas", rhoy: "hasta las 21:00 de hoy", rfinde: "todo el fin de semana",
};

export default async function Inicio({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ck = await cookies();
  const ses = await verificarSesion(ck.get("drc_sesion")?.value);
  const mandos = ses?.rol === "mandos";
  const { filas, alumnos, panel, error } = await cargar();
  const c = panel.control || CONTROL_DEFECTO;
  const salud = await leerSaludBot(c.modo);
  const ahora = new Date();
  const pa = programada(c, ahora);
  const ap = panel.aplicado;
  const envioReal = ap?.autonomo_disponible === true;
  const leido = !!(ap && panel.sha && ap.sha === panel.sha);
  const ci = cierre(filas, alumnos);
  const em = embudo(filas, alumnos);
  const rp = respuestaPersonas(filas);
  const encendido = c.modo === "autonomo";
  const apagado = c.modo === "apagado";
  const ok = typeof sp.ok === "string" ? OK[sp.ok] : undefined;
  const fallo = typeof sp.error === "string" ? sp.error : undefined;
  const hm = madridPartes(ahora).hm;

  const reglaGrupo = "Responderá solo al " + (c.grupo_pct ?? 0) + " % de los leads nuevos, hasta " + describeFase(c.fase_tope) + ", y después pasa el chat a una persona.";
  const sobrePrueba = envioReal ? " Enviará mensajes de verdad." : " De momento el bot está en modo prueba: no envía mensajes reales.";
  const confirmar = (cuando: string) => "¿Encender las respuestas automáticas " + cuando + "? " + reglaGrupo + sobrePrueba;

  return (
    <>
      <AutoRefresco />
      {ok && <Flash texto={ok} />}
      {fallo && <Flash texto={fallo} tono="mal" />}
      {error && <div className="flash mal">No se pueden leer las métricas del bot: {error}</div>}
      {panel.error && <div className="flash mal">No se puede leer el panel en GitHub: {panel.error}</div>}

      {/* 1. Estado */}
      <section className={"card hero " + salud.nivel} aria-live="polite">
        <i className="punto" />
        <div>
          <h1>{salud.titulo}</h1>
          <p>{salud.detalle}</p>
          {apagado && mandos && (
            <form action={cambiarEstado}>
              <button type="submit" name="accion" value="reactivar" className="boton-suave primario">Volver a encender el bot</button>
            </form>
          )}
        </div>
      </section>

      {/* 2. Respuestas automáticas */}
      {!apagado && (
        <section className="card">
          <form action={cambiarEstado} className="sec">
            <input type="hidden" name="confirmo" defaultValue="" />
            <div className="cabecera">
              <span className="titulo">Respuestas automáticas</span>
              <BotonConfirmar
                type="submit" name="accion" value={encendido ? "apagar" : "encender"}
                className={"interruptor" + (encendido ? " on" : "")} role="switch" aria-checked={encendido}
                aria-label={encendido ? "Apagar las respuestas automáticas" : "Encender las respuestas automáticas"}
                mensaje={encendido ? undefined : confirmar("con la programación guardada")} disabled={!mandos}
              />
            </div>
            <p className="linea">
              {!encendido ? (
                <><b>Apagadas.</b> El bot solo sugiere y una persona envía.</>
              ) : pa.activo ? (
                <><b>Encendidas.</b> {describeProg(c)}.</>
              ) : (
                <><b>Encendidas, esperando su horario.</b> {describeProg(c)}.</>
              )}
              {encendido && !leido && <span className="suave"> El bot aún no ha leído el cambio.</span>}
            </p>
            {encendido && <p className="suave">{reglaGrupo}</p>}
            <div className="chips">
              {RAPIDOS.map((r) => (
                <BotonConfirmar key={r} type="submit" name="accion" value={r} className="chip-btn" mensaje={confirmar(DURACION[r])} disabled={!mandos}>
                  {ETIQUETA_RAPIDO[r]}
                </BotonConfirmar>
              ))}
              <Link href="/ajustes#programacion" className="enlace">Programar</Link>
            </div>
            {encendido && caeFueraDeHorario(c.programacion, ahora) && (
              <p className="prueba">Parte de esta programación cae fuera del horario en que el bot actúa ({HORARIO_BOT.desde} a {HORARIO_BOT.hasta}, Madrid): fuera de ese horario no hará nada.</p>
            )}
            {!envioReal && ap && (
              <p className="prueba">Modo prueba: aunque las enciendas, de momento el bot no envía mensajes reales; solo deja el comentario «Habría enviado».</p>
            )}
            {!mandos && <p className="solo-vista">Has entrado con la clave de vista: puedes mirar, no cambiar.</p>}
          </form>
        </section>
      )}

      {/* 3. Cierre */}
      <section className="card">
        <h2>Cierre</h2>
        {!ci ? (
          <p className="vacio">Todavía no hay datos suficientes.</p>
        ) : ci.sinVentas ? (
          <p className="vacio">No se puede medir: falta conectar Respond para saber qué leads acaban comprando (variable RESPONDIO_TOKEN en Vercel).</p>
        ) : ci.bot ? (
          <>
            <div className="dos">
              <div className="dato">
                <span className="rot">Solo el bot</span>
                <span className="num">{p1(ci.bot.conv)}</span>
                <span className="suave">{f0(ci.bot.ventas)} de {f0(ci.bot.leads)} leads</span>
              </div>
              <div className="dato">
                <span className="rot">Con una persona</span>
                <span className="num">{p1(ci.persona.conv)}</span>
                <span className="suave">{f0(ci.persona.ventas)} de {f0(ci.persona.leads)} leads</span>
              </div>
            </div>
            <p className="suave">
              {ci.veredicto === "clara"
                ? (ci.bot.conv ?? 0) > (ci.persona.conv ?? 0) ? "El bot cierra más que una persona." : "Con una persona se cierra más que con el bot."
                : ci.veredicto === "no concluyente" ? "Todavía no hay una diferencia clara entre los dos." : "Aún hay pocos leads para comparar."}
            </p>
          </>
        ) : (
          <>
            <div className="dato">
              <span className="num">{p1(ci.persona.conv)}</span>
              <span className="que">de los leads acaban comprando</span>
              <span className="suave">{f0(ci.persona.ventas)} de {f0(ci.persona.leads)} leads de los últimos 28 días, atendidos por el equipo con las sugerencias del bot.</span>
            </div>
            <div className="fila-suave"><span>Solo el bot</span><span>sin datos: se medirá cuando responda solo</span></div>
          </>
        )}
      </section>

      {/* 4. Cuello de botella */}
      <section className="card">
        <h2>Dónde se pierden los leads</h2>
        {!em ? (
          <p className="vacio">Todavía no hay datos suficientes.</p>
        ) : (
          <>
            <p className="titular">
              {em.peor
                ? <>El mayor corte está de <b>{em.peor.de}</b> a <b>{em.peor.a}</b>: solo pasa el {p0(em.peor.pasa)}.</>
                : "Todavía no hay un corte claro en el embudo."}
            </p>
            <div className="pasos">
              {em.pasos.map((p) => (
                <div key={p.nombre} className={"paso" + (p.peor ? " peor" : "")}>
                  <span>{p.nombre}</span>
                  <div className="pista"><i style={{ width: Math.max(0, Math.min(100, p.pct * 100)) + "%" }} /></div>
                  <span className="n">{f0(p.n)}</span>
                </div>
              ))}
              {!ci?.sinVentas && (
                <div className="paso compran">
                  <span>Compran</span>
                  <div className="pista"><i style={{ width: Math.max(0, Math.min(100, (em.ventas / em.leads) * 100)) + "%" }} /></div>
                  <span className="n">{f0(em.ventas)}</span>
                </div>
              )}
            </div>
            {rp && (
              <div className="sep">
                <div className="lineas"><span>Una persona tarda en contestar</span><b className={rp.mala ? "mal" : ""}>{f1(rp.min)} min</b></div>
                <p className="suave">Mediana de los últimos 7 días; el límite es {rp.limite} min{rp.pct10 != null ? " (" + p0(rp.pct10) + " se contestan a tiempo)" : ""}.</p>
              </div>
            )}
          </>
        )}
      </section>

      <div className="pie">
        <span>{em ? "Datos hasta el " + fmtDia(maxFecha(filas)) + " · " : ""}Actualizado a las {hm}</span>
        <form action={refrescar.bind(null, "/")}><button type="submit">Actualizar</button></form>
      </div>
    </>
  );
}
