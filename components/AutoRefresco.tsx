"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Vuelve a pedir los datos al servidor cada minuto mientras la pestaña está a la vista. No pinta nada. */
export default function AutoRefresco({ cadaSegundos = 60 }: { cadaSegundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, cadaSegundos * 1000);
    return () => clearInterval(id);
  }, [router, cadaSegundos]);
  return null;
}
