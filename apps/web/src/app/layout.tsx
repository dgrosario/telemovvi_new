import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import "@/assets/iconify-icons/generated-icons.css";

const font = localFont({
  src: [
    // Regular
    {
      path: "fonts/SFProText-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "fonts/SFProText-RegularItalic.ttf",
      weight: "400",
      style: "italic",
    },

    // Light
    {
      path: "fonts/SFProText-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "fonts/SFProText-LightItalic.ttf",
      weight: "300",
      style: "italic",
    },

    // Medium
    {
      path: "fonts/SFProText-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "fonts/SFProText-MediumItalic.ttf",
      weight: "500",
      style: "italic",
    },

    // Semibold
    {
      path: "fonts/SFProText-Semibold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "fonts/SFProText-SemiboldItalic.ttf",
      weight: "600",
      style: "italic",
    },

    // Bold
    {
      path: "fonts/SFProText-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "fonts/SFProText-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },

    // Heavy
    {
      path: "fonts/SFProText-Heavy.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "fonts/SFProText-HeavyItalic.ttf",
      weight: "800",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  title: "Telemovvi",
  description: "Seu app  de Atendimento",
  applicationName: "Telemovvi",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Telemovvi",
  },
  openGraph: {
    type: "website",
    siteName: "Telemovvi",
    title: "Telemovvi",
    description: "Seu app  de Atendimento",
  },
  twitter: {
    card: "summary",
    title: "Telemovvi",
    description: "Seu app  de Atendimento",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${font.className} antialiased light h-full overflow-hidden`}
      suppressHydrationWarning
    >
      <head>
        <meta name="author" content="Softtor Soluções Transformadoras LTDA" />
        <meta
          name="copyright"
          content="© 2025 Softtor Soluções Transformadoras LTDA"
        />
        <meta name="apple-mobile-web-app-title" content="Telemovvi" />
        <meta name="application-name" content="Telemovvi" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body
        className="h-full overflow-hidden"
        style={
          {
            "--text-sm": "14px",
            "--text-xs": "12px",
          } as React.CSSProperties
        }
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
