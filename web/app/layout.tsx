import type { Metadata } from "next";
import { Space_Grotesk, Geist, JetBrains_Mono, Baloo_2 } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Geist({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const brand = Baloo_2({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "DOWOracle — Ask the oracle anything",
  description:
    "Crypto research agent. Ask a question, watch it dig through fresh news, forums and threads, get a signal report with citations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} ${brand.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
