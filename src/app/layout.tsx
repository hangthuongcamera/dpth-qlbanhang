import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Đồng phục Thanh Hằng",
  title: {
    default: "Đồng phục Thanh Hằng | Quản lý bán hàng",
    template: "%s | Đồng phục Thanh Hằng",
  },
  description:
    "Phần mềm quản lý bán hàng, khách hàng, đơn hàng và công nợ của Đồng phục Thanh Hằng.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Thanh Hằng",
  },
  icons: {
    apple: [{ url: "/icon.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}


