/**
 * Destination metadata for workflow outputs (HubSpot, Slack, etc.).
 */

export interface Destination {
  id: string;
  name: string;
  slug: string;
  abbrev: string;
  accent: "orange" | "violet" | "neutral" | "blue" | "emerald" | "amber";
}
