// Barras horizontales con etiqueta a la izquierda y valor a la derecha. Componente de servidor.
export type FilaBarra = { etiqueta: string; valor: number | null; texto: string; clase?: "ok" | "casi" | "mal" | "gris" | "" };

export default function BarraH({ filas, maximo = 1, umbral }: { filas: FilaBarra[]; maximo?: number; umbral?: number }) {
  return (
    <div className="barras">
      {filas.map((f) => (
        <div className="pr" key={f.etiqueta}>
          <div>{f.etiqueta}</div>
          <div className="pb">
            <i className={f.clase || ""} style={{ width: (f.valor != null ? Math.max((f.valor / (maximo || 1)) * 100, 0.5) : 0) + "%" }} />
            {umbral != null && <s style={{ left: (umbral / (maximo || 1)) * 100 + "%" }} />}
          </div>
          <div className="tr">{f.texto}</div>
        </div>
      ))}
    </div>
  );
}
