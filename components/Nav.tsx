"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: [string, string][] = [
  ["/", "← Inicio"], ["/salud", "Salud"], ["/preparacion", "Preparación por fase"], ["/grupo", "Grupo de control"],
  ["/auditoria", "Auditoría"], ["/comparar", "Comparar periodos"], ["/ajustes", "Ajustes"],
];

export default function Nav() {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones">
      {TABS.map(([href, t]) => (
        <Link key={href} href={href} aria-current={ruta === href || (href !== "/" && ruta.startsWith(href + "/")) ? "page" : undefined}>{t}</Link>
      ))}
    </nav>
  );
}
