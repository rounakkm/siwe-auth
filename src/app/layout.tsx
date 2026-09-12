import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIWE Session Auth Prototype",
  description: "Sign-In with Ethereum (EIP-4361) and iron-session prototype",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
