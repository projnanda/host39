import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "host39 - A2A Agent Card Hosting",
  description:
    "Host your A2A agent cards at predictable public URLs. No server required.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://host39.org"),
  openGraph: {
    title: "host39 - A2A Agent Card Hosting",
    description:
      "Host your A2A agent cards at predictable public URLs. No server required.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-surface min-h-screen text-ink antialiased">
        <div id="top" className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
