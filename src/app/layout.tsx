import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDA IQ Orchestrator | Phase 1 Demo",
  description: "Microsoft IQと疑似EDA Runnerを連携した承認・監査・PPA比較デモ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
