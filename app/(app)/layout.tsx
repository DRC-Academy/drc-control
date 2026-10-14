import { cookies } from "next/headers";
import Nav from "@/components/Nav";
import { verificarSesion } from "@/lib/sesion";
import { salir } from "@/app/acciones";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const s = await verificarSesion(c.get("drc_sesion")?.value);
  return (
    <main>
      <header className="cab">
        <div className="fila">
          <h1>Centro de control del bot de ventas</h1>
          <form action={salir} className="acciones">
            <span className="nota">{s?.rol === "mandos" ? "Con mandos" : "Solo vista"}</span>
            <button type="submit">Salir</button>
          </form>
        </div>
      </header>
      <Nav />
      <div className="pagina">{children}</div>
    </main>
  );
}
