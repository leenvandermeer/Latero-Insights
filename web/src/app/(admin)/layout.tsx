import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(!t){t='light';localStorage.setItem('theme',t);}document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body className={`${inter.variable}`}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
