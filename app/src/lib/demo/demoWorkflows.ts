/**
 * Demo mode for MVP unblocker.
 *
 * Static sample workflows that let us build/test the full UI
 * without a live n8n connection. Remove when real data flows.
 */

import type { Workflow } from "@/app/workflow-helpers";

export const DEMO_WORKFLOWS: Workflow[] = [
  // ── 1. Lead capture webhook (3 nodes) ────────────────────────
  {
    id: "demo-1",
    name: "Lead Capture — Webhook to CRM",
    active: true,
    updatedAt: "2026-02-10T14:30:00Z",
    createdAt: "2026-01-15T09:00:00Z",
    nodes: [
      {
        id: "n1",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        position: [250, 300],
        parameters: { path: "/new-lead", httpMethod: "POST", responseMode: "onReceived" },
      },
      {
        id: "n2",
        name: "Set Fields",
        type: "n8n-nodes-base.set",
        position: [450, 300],
        parameters: {},
      },
      {
        id: "n3",
        name: "HubSpot — Create Contact",
        type: "n8n-nodes-base.hubspot",
        position: [650, 300],
        parameters: { operation: "create", resource: "contact" },
      },
    ],
    connections: {
      Webhook: { main: [[{ node: "Set Fields", type: "main", index: 0 }]] },
      "Set Fields": {
        main: [[{ node: "HubSpot — Create Contact", type: "main", index: 0 }]],
      },
    },
  },

  // ── 2. CRM Sync with branching (6 nodes) ────────────────────
  {
    id: "demo-2",
    name: "Daily CRM Sync + Alerts",
    active: true,
    updatedAt: "2026-02-12T08:15:00Z",
    createdAt: "2026-01-20T11:00:00Z",
    nodes: [
      {
        id: "n1",
        name: "Schedule Trigger",
        type: "n8n-nodes-base.scheduleTrigger",
        position: [200, 300],
        parameters: {
          rule: { interval: [{ field: "hours", hoursInterval: 1 }] },
        },
      },
      {
        id: "n2",
        name: "Fetch Contacts",
        type: "n8n-nodes-base.httpRequest",
        position: [400, 300],
        parameters: { url: "https://api.example.com/contacts", method: "GET" },
      },
      {
        id: "n3",
        name: "Has Changes?",
        type: "n8n-nodes-base.if",
        position: [600, 300],
        parameters: {},
      },
      {
        id: "n4",
        name: "Update Google Sheet",
        type: "n8n-nodes-base.googleSheets",
        position: [800, 200],
        parameters: { operation: "append" },
      },
      {
        id: "n5",
        name: "Notify Slack",
        type: "n8n-nodes-base.slack",
        position: [800, 400],
        parameters: { channel: "#crm-updates" },
      },
      {
        id: "n6",
        name: "Log — No Changes",
        type: "n8n-nodes-base.noOp",
        position: [800, 500],
        parameters: {},
      },
    ],
    connections: {
      "Schedule Trigger": {
        main: [[{ node: "Fetch Contacts", type: "main", index: 0 }]],
      },
      "Fetch Contacts": {
        main: [[{ node: "Has Changes?", type: "main", index: 0 }]],
      },
      "Has Changes?": {
        main: [
          [
            { node: "Update Google Sheet", type: "main", index: 0 },
            { node: "Notify Slack", type: "main", index: 0 },
          ],
          [{ node: "Log — No Changes", type: "main", index: 0 }],
        ],
      },
    },
  },

  // ── 3. Stripe invoice log (4 nodes) ─────────────────────────
  {
    id: "demo-3",
    name: "Stripe Invoice → Notion Log",
    active: false,
    updatedAt: "2026-02-08T17:45:00Z",
    createdAt: "2026-02-01T10:30:00Z",
    nodes: [
      {
        id: "n1",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        position: [250, 300],
        parameters: { path: "/stripe-webhook", httpMethod: "POST" },
      },
      {
        id: "n2",
        name: "Parse Payload",
        type: "n8n-nodes-base.code",
        position: [450, 300],
        parameters: {},
      },
      {
        id: "n3",
        name: "Create Notion Page",
        type: "n8n-nodes-base.notion",
        position: [650, 300],
        parameters: { operation: "create" },
      },
      {
        id: "n4",
        name: "Respond OK",
        type: "n8n-nodes-base.respondToWebhook",
        position: [850, 300],
        parameters: {},
      },
    ],
    connections: {
      Webhook: { main: [[{ node: "Parse Payload", type: "main", index: 0 }]] },
      "Parse Payload": {
        main: [[{ node: "Create Notion Page", type: "main", index: 0 }]],
      },
      "Create Notion Page": {
        main: [[{ node: "Respond OK", type: "main", index: 0 }]],
      },
    },
  },
];
