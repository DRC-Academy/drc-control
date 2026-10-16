"use client";
import { useEffect, useState } from "react";

/** Aviso breve tras un cambio ("Respuestas automáticas encendidas"). Se quita solo y limpia la dirección. */
export default function Flash({ texto, tono }: { texto: string; tono?: "mal" }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const limpiar = () => { try { window.history.replaceState(null, "", window.location.pathname); } catch { /* sin historial */ } };
    const a = setTimeout(limpiar, 800);
    const b = setTimeout(() => setVisible(false), tono === "mal" ? 12000 : 5000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [tono]);
  if (!visible) return null;
  return <div className={"flash" + (tono ? " " + tono : "")} role="status">{texto}</div>;
}
