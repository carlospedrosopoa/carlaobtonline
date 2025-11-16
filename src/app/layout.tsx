import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Menu from "@/components/Menu";

export const metadata: Metadata = {
  title: "App Unificado",
  description: "Sistema completo com frontend e backend",
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
          <Menu />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
