import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import SuspendedAccountGate from "@/components/auth/SuspendedAccountGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://buntomo.bunkare.jp"),
  title: {
    default: "ブントモ（文とも）｜読書を、もっと一緒に",
    template: "%s｜ブントモ",
  },
  description:
    "ブントモ（文とも）は、読みかけの本の進捗を記録し、同じ本を読む仲間と出会い、読了後の感想を語り合える読書支援サービスです。読書記録・読書会・読書仲間探しを無料で。",
  keywords: [
    "ブントモ", "文とも", "buntomo",
    "読書", "読書記録", "読書SNS", "読書会", "読書管理",
    "読書仲間", "読書進捗", "本", "読書コミュニティ", "読書支援",
  ],
  applicationName: "ブントモ",
  authors: [{ name: "多摩中読書倶楽部" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://buntomo.bunkare.jp",
    siteName: "ブントモ",
    title: "ブントモ（文とも）｜読書を、もっと一緒に",
    description:
      "読みかけの本の進捗を記録し、同じ本を読む仲間と出会い、読了の余韻を分かち合える読書支援サービス。",
    images: [{ url: "/logo.png", width: 2158, height: 572, alt: "ブントモ" }],
  },
  twitter: {
    card: "summary",
    title: "ブントモ（文とも）｜読書を、もっと一緒に",
    description: "同じ本を読む仲間と出会える読書支援サービス。",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-gray-50">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "ブントモ",
              alternateName: ["文とも", "buntomo"],
              url: "https://buntomo.bunkare.jp",
              description: "同じ本を読む仲間と出会える読書支援サービス",
              publisher: {
                "@type": "Organization",
                name: "多摩中読書倶楽部",
              },
            }),
          }}
        />
        <GoogleAnalytics />
        <SessionProvider>
          <SuspendedAccountGate />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
