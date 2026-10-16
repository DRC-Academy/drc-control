"use client";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

/**
 * Botón de envío que pide confirmación antes de actuar. Si la persona acepta, rellena el campo oculto "confirmo" del
 * formulario; el servidor no hace el cambio sin él. Mientras el formulario se envía, el botón queda desactivado.
 */
export default function BotonConfirmar({ mensaje, children, disabled, ...resto }: ButtonHTMLAttributes<HTMLButtonElement> & { mensaje?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...resto}
      disabled={disabled || pending}
      onClick={(e) => {
        if (!mensaje) return;
        if (!window.confirm(mensaje)) {
          e.preventDefault();
          return;
        }
        const campo = e.currentTarget.form?.elements.namedItem("confirmo");
        if (campo instanceof HTMLInputElement) campo.value = "on";
      }}
    >
      {children}
    </button>
  );
}
