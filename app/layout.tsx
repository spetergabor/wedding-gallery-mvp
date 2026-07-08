import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spetly",
  description: "Client galleries, bookings, contracts and calendar workflows for photographers."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
