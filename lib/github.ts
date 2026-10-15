// Lectura y escritura de archivos en la rama estado del repositorio del bot, por la API de GitHub.
// Solo en el servidor. Nunca se leen propuestas/ (memoria de los chats): solo metricas/ y los archivos de control.
import "server-only";

const API = process.env.GITHUB_API_URL || "https://api.github.com";

export function repo(): string {
  return process.env.REPO_BOT || "drcacademycourses/drc-respond";
}
export function rama(): string {
  return process.env.RAMA_ESTADO || "estado";
}

function cabeceras(raw = false): Record<string, string> {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("Falta la variable GITHUB_TOKEN en Vercel");
  return {
    Authorization: `Bearer ${t}`,
    Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "drc-control",
  };
}

export type Entrada = { name: string; sha: string; size: number };

export async function listarDir(ruta: string): Promise<Entrada[]> {
  const r = await fetch(`${API}/repos/${repo()}/contents/${ruta}?ref=${rama()}`, { headers: cabeceras(), cache: "no-store" });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`GitHub ${r.status} al listar ${ruta}`);
  const j = (await r.json()) as { name: string; sha: string; size: number; type: string }[];
  return j.filter((x) => x.type === "file").map(({ name, sha, size }) => ({ name, sha, size }));
}

export async function leerTexto(ruta: string): Promise<string | null> {
  const r = await fetch(`${API}/repos/${repo()}/contents/${ruta}?ref=${rama()}`, { headers: cabeceras(true), cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} al leer ${ruta}`);
  return r.text();
}

export async function leerJson<T>(ruta: string): Promise<{ data: T; sha: string } | null> {
  const r = await fetch(`${API}/repos/${repo()}/contents/${ruta}?ref=${rama()}`, { headers: cabeceras(), cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} al leer ${ruta}`);
  const j = (await r.json()) as { content: string; sha: string };
  const texto = Buffer.from(j.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { data: JSON.parse(texto) as T, sha: j.sha };
}

export async function escribirJson(ruta: string, data: unknown, mensaje: string, sha?: string): Promise<string> {
  const cuerpo = {
    message: mensaje,
    content: Buffer.from(JSON.stringify(data, null, 1) + "\n").toString("base64"),
    branch: rama(),
    ...(sha ? { sha } : {}),
  };
  const r = await fetch(`${API}/repos/${repo()}/contents/${ruta}`, {
    method: "PUT",
    headers: { ...cabeceras(), "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} al escribir ${ruta}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { content: { sha: string } };
  return j.content.sha;
}
