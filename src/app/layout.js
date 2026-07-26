import Script from "next/script";
import "./globals.css";
import { Providers } from "./Providers";

export const metadata = {
  title: "SecureKYC — Instant Identity Verification",
  description: "Complete your KYC in minutes. Secure, compliant, and seamless identity verification for your financial journey.",
  keywords: ["KYC", "identity verification", "fintech", "demat account", "NSDL"],
  icons: {
    icon: '/stklogo.png',
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#9fe870" />
      </head>
      <body>
        <Script 
          src="https://app.digio.in/sdk/v11/digio.js" 
          strategy="beforeInteractive"
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
