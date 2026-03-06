import { prisma } from "./prisma";

/**
 * Returns the demo user, creating it if it doesn't exist.
 *
 * TODO: Replace this with real auth (e.g. Supabase Auth / NextAuth)
 * when authentication is implemented. Every call-site that uses
 * getDemoUser() should then use the authenticated session user instead.
 */
export async function getDemoUser() {
  return prisma.user.upsert({
    where: { email: "demo@controlplane.dev" },
    update: {},
    create: { email: "demo@controlplane.dev", name: "Demo User" },
  });
}
