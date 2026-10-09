// Root layout: the HTML shell shared by every page (language, skip link, header, main landmark).
// Accessibility starts here: <html lang>, a "skip to content" link and one <main> per page.
// CONCEPT: accessibility
import type { Metadata } from "next";
import { NavBar } from "../components/NavBar";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TicketLite",
  description: "Browse events and book seats.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {/* Keyboard users can jump past the header straight to the page content. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-white focus:p-2"
        >
          Skip to content
        </a>
        <Providers>
          <header className="border-b border-slate-200 bg-white">
            <NavBar />
          </header>
          <main id="main" className="mx-auto max-w-5xl p-4">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
