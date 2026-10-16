import { entrar } from "@/app/acciones";

export default async function Entrar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : "";
  const a = typeof sp.a === "string" ? sp.a : "/";
  const sinClaves = !process.env.CLAVE_MANDOS && !process.env.CLAVE_VISTA;
  return (
    <main>
      <div className="entrar">
        <h1 style={{ margin: 0 }}>Centro de control del bot de ventas</h1>
        <p className="nota">DRC Academy. Entra con la clave de vista o con la clave de mandos.</p>
        {sinClaves && <div className="aviso mal">Faltan las variables CLAVE_MANDOS y CLAVE_VISTA en Vercel: nadie puede entrar todavía.</div>}
        {error === "1" && <div className="aviso mal">Clave incorrecta.</div>}
        {error === "2" && <div className="aviso mal">La app no tiene claves configuradas.</div>}
        <form action={entrar} className="tarjeta">
          <input type="hidden" name="a" value={a} />
          <label className="nota" htmlFor="clave">Clave</label>
          <input id="clave" name="clave" type="password" autoComplete="current-password" required />
          <div className="acciones"><button className="primario" type="submit">Entrar</button></div>
        </form>
      </div>
    </main>
  );
}
