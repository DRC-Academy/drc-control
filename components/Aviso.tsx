export default function Aviso({ texto, tono }: { texto: string; tono?: "mal" | "aviso" }) {
  return <div className={"aviso " + (tono || "")}>{texto}</div>;
}
