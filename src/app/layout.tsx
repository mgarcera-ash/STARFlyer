import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "STARFlyer",
  description: "Every flyer we find, in your hands.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme');
            if (t) document.documentElement.setAttribute('data-theme', t);
            else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
              document.documentElement.setAttribute('data-theme', 'dark');
          } catch(e) {}
        `}} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
