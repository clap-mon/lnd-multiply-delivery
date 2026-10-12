import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "럭키팡 숫자던전: 구구단특급",
  description: "초등학교 2학년 곱셈구구를 배우는 카드 배틀",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
