import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OroData Dashboard",
  description: "Responsive operations dashboard for stations, employees, POS terminals, and fares.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
