import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "House of Kareevsky",
  description: "A private messenger-like home for stories, songs and letters",
  applicationName: "House of Kareevsky",
  manifest: "/manifest.webmanifest",
  themeColor: "#000000",
  appleWebApp: {
    statusBarStyle: "black-translucent",
    title: "House of Kareevsky",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=Inter:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

