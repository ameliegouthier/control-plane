import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@/styles/index.css";
import { ProviderFilterProvider } from "@/contexts/ProviderFilterContext";
import Sidebar from "@/components/sidebar/Sidebar";
import { getIntegrationsForOverview } from "@/lib/repositories/integrationsRepository";

export const metadata: Metadata = {
  title: "Governance",
  description: "Discover, understand, and fix your automation system.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("demo_mode")?.value;
  const envDefault = process.env.DEMO_MODE === "true";

  const demoMode =
    typeof cookieValue === "string" ? cookieValue === "true" : envDefault;

  const integrations = demoMode ? [] : await getIntegrationsForOverview();

  const providersFromIntegrations = Array.from(
    new Set(
      integrations
        .map((i) => i.provider)
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0),
    ),
  );

  return (
    <html lang="en">
      <body className="bg-[#fafafa] antialiased">
        <ProviderFilterProvider initialProvidersFromIntegrations={providersFromIntegrations}>
          <Sidebar
            integrationIds={(integrations as { id: string }[]).map((i) => i.id)}
            initialDemoMode={demoMode}
          />
          {children}
        </ProviderFilterProvider>
      </body>
    </html>
  );
}
