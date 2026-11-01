import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Guardian — the safety layer between AI agents and PayPal",
  description:
    "Policy engine, human-approval queue and audit trail that govern what AI agents may do with PayPal payments.",
  openGraph: {
    title: "Agent Guardian — the safety layer between AI agents and PayPal",
    description:
      "Every agent tool call passes policy rules, a risk model, and (when it must) a human before money moves.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
