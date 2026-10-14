export default function Chip({ texto, tono }: { texto: string; tono?: "ok" | "mal" | "aviso" | "" }) {
  return <span className={"chip " + (tono || "")}>{texto}</span>;
}
