import { f0, fmtDia, p0 } from "@/lib/formato";
import type { Parecido } from "@/lib/parecido";
import { PARECIDO_ALTO } from "@/lib/parecido";
import Grafica from "@/components/Grafica";

/** Tarjeta de la portada: cuánto se parecen las propuestas del bot a lo que Diego envía de verdad, y si sube semana a semana. */
export default function ParecidoDiego({ datos }: { datos: Parecido | null }) {
  if (!datos) return <p className="vacio">Todavía no hay medidas: el bot compara cada noche sus propuestas con lo que envía Diego.</p>;
  const { ult, prev, delta } = datos;
  const sube = delta == null ? null : Math.round(delta);
  return (
    <>
      <div className="dato">
        <span className="num">{p0(ult.media)}</span>
        <span className="que">de parecido con lo que tú envías</span>
        <span className="suave">
          {f0(ult.n)} respuestas tuyas a propuestas del bot ({fmtDia(datos.desde)} a {fmtDia(datos.hasta)}); muy parecidas (desde {p0(PARECIDO_ALTO)}), el {p0(ult.altas)}.
        </span>
      </div>
      <p className="titular">
        {sube == null
          ? prev.n ? "Esta semana no hay respuestas tuyas para comparar." : "Es la primera semana medida: a partir de la próxima se verá si sube."
          : sube > 0 ? <>Sube <b>{sube} puntos</b> frente a los 7 días anteriores ({p0(prev.media)}).</>
          : sube < 0 ? <>Baja <b>{-sube} puntos</b> frente a los 7 días anteriores ({p0(prev.media)}).</>
          : <>Igual que los 7 días anteriores ({p0(prev.media)}).</>}
      </p>
      {datos.semanas.length > 1 && (
        <Grafica
          puntos={datos.semanas.map((s) => ({ x: s.x, y: s.y, detalle: [["Respuestas", f0(s.n)]] }))}
          fmt="pct" xfmt="semana" dominio={[0, 1]} etiqueta="Parecido a Diego por semana" alto={160}
        />
      )}
      <p className="suave">Se compara el texto de la propuesta con el mensaje que enviaste a ese mismo mensaje del lead. El bot aprende cada noche de tus chats y la guía de tu estilo se ajusta sola.</p>
    </>
  );
}
