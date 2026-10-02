import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Invoice Intake Checker", template: "%s · Invoice Intake Checker" },
  description:
    "Check incoming supplier invoices: VAT numbers via VIES, ECB exchange rates, duplicate detection and price increases.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-faint sm:px-6">
          AI is only used to read the invoice. VAT checks (VIES), exchange rates (ECB) and duplicate and price
          checks are plain code.
        </footer>
      </body>
    </html>
  );
}
