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

// OG 이미지(public/images/og-image-v3.png)는 디자이너가 만든 public/images/OG
// 태그_3.svg(1200x630, 원본 그대로 보존)를 그대로 PNG로 레스터화한 것 —
// 노션의 작은 북마크 미리보기 등 아주 작은 썸네일에서도 로고·설명 문구가
// 읽히도록 v2보다 로고/텍스트를 더 키운 버전이다(실측 비교 결과 v2보다
// 작은 크기 가독성이 우수함을 확인하고 채택). 기존 og-image.png/v2 및
// 두 SVG 원본은 비교/롤백용으로 그대로 남겨두고 건드리지 않는다. SNS 링크
// 미리보기(카카오톡/트위터 등)가 og:image로 SVG를 안정적으로 지원하지
// 않아 PNG가 필요하다 — 디자인을 다시 그리지 않고 변환만 한다.
const SITE_URL = "https://modo-blond.vercel.app";
const OG_IMAGE_PATH = "/images/og-image-v3.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "MODO",
  description: "AI가 목표를 실행 가능한 일일 계획으로 만들고, 상황에 맞춰 다시 조정해주는 목표 관리 서비스",
  openGraph: {
    title: "MODO",
    description: "AI가 목표를 실행 가능한 일일 계획으로 만들고, 상황에 맞춰 다시 조정해주는 목표 관리 서비스",
    url: SITE_URL,
    siteName: "MODO",
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630 }],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MODO",
    description: "AI가 목표를 실행 가능한 일일 계획으로 만들고, 상황에 맞춰 다시 조정해주는 목표 관리 서비스",
    images: [OG_IMAGE_PATH],
  },
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
