import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Reserva de Turnos Online - Agenda Fácil",
  description: "Plataforma digital para la gestión y reserva de turnos online. Rápido, seguro e interactivo.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-brand-dark font-sans selection:bg-brand-mint selection:text-brand-dark">
        {children}
      </body>
    </html>
  );
}
