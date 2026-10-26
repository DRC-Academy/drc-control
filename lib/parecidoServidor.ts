// Lectura de parecido-diego.jsonl (rama estado). Solo servidor; se cachea 5 minutos.
import "server-only";
import { unstable_cache } from "next/cache";
import { leerTexto } from "./github";
import { leerFilasParecido, type FilaPar } from "./parecido";

export const leerParecido = unstable_cache(
  async (): Promise<FilaPar[]> => leerFilasParecido(await leerTexto("parecido-diego.jsonl")),
  ["parecido-diego"],
  { revalidate: 300, tags: ["parecido"] },
);
