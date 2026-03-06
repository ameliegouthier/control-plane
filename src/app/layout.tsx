import type { Metadata } from "next";
import "@/styles/index.css";

export const metadata: Metadata = {
  title: "Governance",
  description: "Discover, understand, and fix your automation system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#fafafa] antialiased">
        {children}
      </body>
    </html>
  );
}
