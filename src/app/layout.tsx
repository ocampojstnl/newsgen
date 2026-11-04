import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeRoot } from "@/components/theme-root";
import { CLEAR_VIEW_SCRIPT } from "@/lib/clear-view-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "NewsGen", template: "%s · NewsGen" },
  description: "Sourced, checked news writing for Philippine reporters.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {/* Applies Clear view before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: CLEAR_VIEW_SCRIPT }} />
      </head>
      <body className="h-full">
        <ThemeRoot>{children}</ThemeRoot>
      </body>
    </html>
  );
}
