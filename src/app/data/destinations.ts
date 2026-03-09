/**
 * Single source of truth for destination metadata.
 * Used by System Map, destination detail page, and any destination-related UI.
 * Do not hardcode destination names, slugs, or colors in components.
 */

export interface DestinationMeta {
  id: string;
  name: string;
  slug: string;
  abbrev: string;
  /** Tailwind accent: bg-{accent}-100, text-{accent}-700 */
  accent: "orange" | "violet" | "neutral" | "blue" | "emerald" | "amber";
}

export const DESTINATIONS: DestinationMeta[] = [
  { id: "hubspot", name: "HubSpot", slug: "hubspot", abbrev: "HS", accent: "orange" },
  { id: "slack", name: "Slack", slug: "slack", abbrev: "Sl", accent: "violet" },
  { id: "notion", name: "Notion", slug: "notion", abbrev: "N", accent: "neutral" },
  { id: "airtable", name: "Airtable", slug: "airtable", abbrev: "At", accent: "blue" },
  { id: "google-sheets", name: "Google Sheets", slug: "google-sheets", abbrev: "GS", accent: "emerald" },
  { id: "mailchimp", name: "Mailchimp", slug: "mailchimp", abbrev: "MC", accent: "amber" },
];

const slugToDestination = new Map(DESTINATIONS.map((d) => [d.slug, d]));
const nameToDestination = new Map(DESTINATIONS.map((d) => [d.name, d]));

/** Normalize display name to slug (e.g. "Google Sheets" → "google-sheets") */
export function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

/** Get destination metadata by slug (URL param) */
export function getDestinationBySlug(slug: string): DestinationMeta | undefined {
  return slugToDestination.get(slug);
}

/** Get destination metadata by display name (e.g. from workflow.output) */
export function getDestinationByName(name: string): DestinationMeta | undefined {
  const slug = nameToSlug(name);
  return slugToDestination.get(slug) ?? nameToDestination.get(name);
}
