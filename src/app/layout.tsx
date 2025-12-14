import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IBDaily",
  description: "Track your daily IB concept summaries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50 dark:bg-gray-900">
        {children}
      </body>
    </html>
  );
}
