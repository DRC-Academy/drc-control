export default function Kpi({ valor, etiqueta, detalle, malo }: { valor: string; etiqueta: string; detalle?: string; malo?: boolean }) {
  return (
    <div className={"kpi" + (malo ? " mal" : "")}>
      <span className="v">{valor}</span>
      <span className="l">{etiqueta}</span>
      {detalle && <span className="d">{detalle}</span>}
    </div>
  );
}
