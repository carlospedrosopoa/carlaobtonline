import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import MenuWrapper from "@/components/MenuWrapper";

export const metadata: Metadata = {
  title: "Carlão BT Online",
  description: "Sistema completo de gestão de tênis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <AuthProvider>
          {/* Menu global - aparece em /dashboard, /perfil, etc. Mas não em /app/* que têm layouts próprios */}
          <MenuWrapper />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
