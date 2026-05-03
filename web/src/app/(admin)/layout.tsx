import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../../styles/admin-globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Latero Control — Admin",
  description: "Latero Control platform operator console",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-slate-50 text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
