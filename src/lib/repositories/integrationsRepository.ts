/**
 * Integration data for overview and sync orchestration.
 * Returns all integrations for the current user that have a registered provider adapter.
 */

import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import {
  getRegisteredProviders,
  type AutomationProvider,
} from "@/lib/providers";

export interface IntegrationForOverview {
  id: string;
  provider: string;
}

const SUPPORTED_PROVIDERS = new Set(getRegisteredProviders());

/**
 * Load all integrations for the current (demo) user that can be synced.
 * Used by the overview page so Resync runs for every connected provider,
 * including those with no workflows yet (e.g. newly connected Make).
 */
export async function getIntegrationsForOverview(): Promise<IntegrationForOverview[]> {
  const user = await getDemoUser();
  const rows = await prisma.integration.findMany({
    where: { userId: user.id },
    select: { id: true, provider: true },
  });

  let resultRows = rows;

  // When MOCK_MAKE is enabled, ensure a Make integration exists for the demo user
  if (process.env.MOCK_MAKE) {
    const hasMake = rows.some(
      (r) => r.provider.toLowerCase() === "make",
    );

    if (!hasMake) {
      const mockIntegration = await prisma.integration.create({
        data: {
          userId: user.id,
          provider: "make",
          name: "Make (Mock)",
          status: "ACTIVE",
          credentials: {},
          config: {},
        },
      });

      resultRows = [...rows, { id: mockIntegration.id, provider: mockIntegration.provider }];
    }
  }

  return resultRows
    .filter((r) =>
      SUPPORTED_PROVIDERS.has(r.provider.toLowerCase() as AutomationProvider)
    )
    .map((r) => ({ id: r.id, provider: r.provider }));
}
