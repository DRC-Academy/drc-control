import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bot de ventas",
  description: "DRC Academy: estado del bot de ventas, respuestas automáticas, cierre y dónde se pierden los leads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
