import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COSUMA-RDC — Procès-verbaux",
  description:
    "Prise de notes audio/texte et génération automatique de procès-verbaux et comptes-rendus pour la COSUMA-RDC.",
  icons: { icon: "/logo-cosuma.png", apple: "/logo-cosuma.png" },
  appleWebApp: { capable: true, title: "COSUMA PV" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f3864",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
