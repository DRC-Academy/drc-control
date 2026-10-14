import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Centro de control del bot de ventas",
  description: "DRC Academy: salud, preparación por fase, grupo de control, auditoría y panel del bot de ventas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
