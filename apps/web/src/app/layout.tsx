import type { Metadata } from "next";
import { Gothic_A1, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap"
});

const gothic = Gothic_A1({
  weight: ["700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-gothic",
  display: "swap"
});

export const metadata: Metadata = {
  title: "바로 뚫림",
  description: "배수 문제 신고 접수 및 업체 배정 플랫폼"
};

// 저장된 테마를 첫 페인트 전에 적용해 깜빡임을 막는다. (기본: 밝음)
const themeInit = `(function(){try{if(localStorage.getItem("theme")==="dark"){document.documentElement.dataset.theme="dark"}}catch(e){}})()`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${plex.variable} ${gothic.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
