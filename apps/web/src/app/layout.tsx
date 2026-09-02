import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "바로 뚫림",
  description: "배수 문제 신고 접수 및 업체 배정 플랫폼"
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