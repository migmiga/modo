import type { Metadata } from "next";
import localFont from "next/font/local";

import { AppHeaderBar, AppHeaderProvider } from "@/components/layout/AppHeader";
import { SideNav } from "@/components/layout/SideNav";

import { Providers } from "./providers";
import "./globals.css";

// Single variable font covering every weight (45–920) used across the app —
// see app/globals.css for how --font-pretendard is wired into --font-sans /
// --font-heading so no component needs to reference a font-family itself.
const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MODO",
  description: "AI가 목표를 실행 가능한 일일 계획으로 만들고, 상황에 맞춰 다시 조정해주는 목표 관리 서비스",
  icons: {
    // SVG listed first — scalable, so supporting browsers prefer it over the
    // fixed-size PNG fallbacks below (sizes: "any" is the standard signal
    // for "this works at any resolution"). LOGO2.svg replaces the earlier
    // favicon-32x32.svg as this default — only one SVG entry at a time, to
    // avoid two competing scalable icons.
    icon: [
      { url: "/images/LOGO2.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <AppHeaderProvider>
            <SideNav />
            <div data-ld="main-wrapper" className="lg:pl-[300px]">
              <AppHeaderBar />
              {children}
            </div>
          </AppHeaderProvider>
        </Providers>
      </body>
    </html>
  );
}
