import { FASES } from "@/lib/analisis";
import { p0 } from "@/lib/formato";
import { UMBRAL_COPIA, type Autonomia as Datos } from "@/lib/autonomia";

/**
 * Hasta dónde puede responder el bot sin ayuda humana. Una fila por fase con el % de respuestas en que la persona envía
 * la sugerencia tal cual y una marca en el 85 %: verde si pasa, rojo la fase que corta, gris lo que queda después.
 */
export default function Autonomia({ datos, faseTope }: { datos: Datos | null; faseTope: string }) {
  if (!datos) return <p className="vacio">Todavía no hay datos suficientes.</p>;
  const orden = FASES.map(([k]) => k as string);
  const iTope = orden.indexOf(faseTope), iHasta = datos.hasta ? orden.indexOf(datos.hasta) : -1;
  return (
    <>
      <p className="grande-texto">{datos.hasta ? <>Hasta <b>{datos.hastaNombre}</b></> : <>Todavía en ninguna fase</>}</p>
      <p className="suave">
        {datos.hasta
          ? "Hasta ahí, las personas envían la sugerencia del bot tal cual en el " + p0(datos.copiaHasta) + " de las respuestas."
          : "Ni en la primera fase llegan las respuestas copiadas tal cual al " + p0(UMBRAL_COPIA) + "."}
      </p>
      <div className="aut" role="list">
        {datos.etapas.map((e) => {
          const pocos = e.estado === "pocos";
          return (
            <div key={e.fase} className={"a-fila " + e.estado + (e.fase === faseTope ? " tope" : "")} role="listitem" title={e.n + " respuestas"}>
              <span className="a-nombre">{e.nombre}{e.fase === faseTope && <em>tope</em>}</span>
              <div className="a-pista">
                {!pocos && e.copia != null && <i style={{ width: Math.max(2, e.copia * 100) + "%" }} />}
                <s style={{ left: UMBRAL_COPIA * 100 + "%" }} />
              </div>
              <span className="a-pct">{pocos || e.copia == null ? "pocos datos" : p0(e.copia)}</span>
            </div>
          );
        })}
      </div>
      <p className="suave">Marca: {p0(UMBRAL_COPIA)}. Cuenta lo que la persona envía tal cual o con cambios mínimos.</p>
      {iTope > iHasta && <p className="prueba">Tu fase tope es {FASES[iTope][1]}, por encima de lo que hoy aguanta sin ayuda{datos.hastaNombre ? " (hasta " + datos.hastaNombre + ")" : ""}.</p>}
      {iTope >= 0 && iTope < iHasta && <p className="suave">Podrías subir la fase tope hasta {datos.hastaNombre}.</p>}
    </>
  );
}
