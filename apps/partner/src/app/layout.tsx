import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "바로 뚫림 · 업체",
  description: "배수 작업 업체 배정 및 작업 관리"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}