/**
 * Demo mode for MVP unblocker.
 *
 * Provider-agnostic demo workflows for testing multi-provider architecture.
 * Includes workflows from both n8n and Make providers.
 * Remove when real data flows.
 */

import type { Workflow, WorkflowGraph, WorkflowGraphNode, WorkflowGraphEdge } from "@/app/workflow-helpers";
import type { RawWorkflow } from "@/lib/enrichment";

// Demo connection IDs (simulates real connections)
const DEMO_CONNECTION_N8N = "demo-n8n-connection-001";
const DEMO_CONNECTION_MAKE = "demo-make-connection-001";

// Extended Workflow type with enrichment fields
export interface WorkflowWithEnrichmentFields extends Workflow {
  triggerType?: string;
  nodesCount?: number;
  hasPublicWebhook?: boolean;
  lastExecutionStatus?: "success" | "error" | null;
  lastExecutionDate?: string | null;
  /** Canonical destination for grouping (from __demo.destination). */
  outputDestination?: string;
  /** Override health for demo (from __demo.health). */
  healthOverride?: "ok" | "warning" | "broken" | "optimizable";
}

// ─── Generic Demo Workflow Structure ────────────────────────────────────────

interface DemoWorkflowRaw {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    parameters?: Record<string, unknown>;
    disabled?: boolean;
    notes?: string;
    credentials?: Record<string, unknown>;
  }>;
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  tags?: string[];
  // Enrichment fields for Overview page
  triggerType?: "webhook" | "cron" | "manual" | "none" | string;
  hasPublicWebhook?: boolean;
  lastExecutionStatus?: "success" | "error" | null;
  lastExecutionDate?: string | null;
  __demo?: {
    expectedErrors?: string[];
    duplicateGroup?: string;
    duplicateHint?: string;
    /** Canonical destination for System Map grouping (e.g. HubSpot, Slack). */
    destination?: string;
    /** Override health for demo (ok | warning | broken | optimizable). */
    health?: "ok" | "warning" | "broken" | "optimizable";
  };
}

// ─── Demo Workflows Data ────────────────────────────────────────────────────

// n8n workflows (first 2)
const N8N_DEMO_WORKFLOWS: DemoWorkflowRaw[] = [
    // 1) MARKETING – Lead magnet -> nurture -> CRM
    {
      id: "101",
      name: "Lead Magnet → Email Nurture → HubSpot Sync",
      active: true,
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-10T09:00:00.000Z",
      tags: ["marketing", "crm"],
      __demo: { destination: "HubSpot", health: "optimizable" },
      triggerType: "webhook",
      hasPublicWebhook: true,
      lastExecutionStatus: "success",
      lastExecutionDate: "2026-02-16T10:30:00Z",
      nodes: [
        {
          id: "n1",
          name: "Webhook - Lead Form",
          type: "n8n-nodes-base.webhook",
          parameters: { path: "lead-form", httpMethod: "POST" },
        },
        {
          id: "n2",
          name: "Validate Email",
          type: "n8n-nodes-base.if",
          parameters: {
            rules: [{ field: "email", operation: "isEmail" }],
          },
        },
        {
          id: "n3",
          name: "Add/Update Contact in HubSpot",
          type: "n8n-nodes-base.hubspot",
          parameters: { resource: "contact", operation: "upsert" },
          credentials: { hubspotOAuth2Api: { id: "cred_hubspot_1" } },
        },
        {
          id: "n4",
          name: "Send Welcome Email (Gmail)",
          type: "n8n-nodes-base.gmail",
          parameters: {
            operation: "send",
            subject: "Welcome!",
            to: "={{$json.email}}",
          },
          credentials: { gmailOAuth2: { id: "cred_gmail_1" } },
        },
        {
          id: "n5",
          name: "Tag Invalid Lead",
          type: "n8n-nodes-base.hubspot",
          parameters: {
            resource: "contact",
            operation: "update",
            properties: { lifecycleStage: "other" },
          },
          credentials: { hubspotOAuth2Api: { id: "cred_hubspot_1" } },
        },
      ],
      connections: {
        "Webhook - Lead Form": {
          main: [
            [{ node: "Validate Email", type: "main", index: 0 }],
          ],
        },
        "Validate Email": {
          main: [
            [
              {
                node: "Add/Update Contact in HubSpot",
                type: "main",
                index: 0,
              },
            ],
            [{ node: "Tag Invalid Lead", type: "main", index: 0 }],
          ],
        },
        "Add/Update Contact in HubSpot": {
          main: [
            [
              {
                node: "Send Welcome Email (Gmail)",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
      },
    },

    // 2) CRM – Stripe -> Notion -> Slack
    {
      id: "102",
      name: "Stripe Payment → Notion CRM → Slack Alert",
      active: true,
      createdAt: "2026-01-15T08:30:00.000Z",
      updatedAt: "2026-02-05T11:12:00.000Z",
      tags: ["crm", "finance", "ops"],
      __demo: { destination: "Slack" },
      triggerType: "webhook",
      hasPublicWebhook: false,
      lastExecutionStatus: "success",
      lastExecutionDate: "2026-02-17T08:15:00Z",
      nodes: [
        {
          id: "n1",
          name: "Stripe Trigger",
          type: "n8n-nodes-base.stripeTrigger",
          parameters: { event: "payment_intent.succeeded" },
          credentials: { stripeApi: { id: "cred_stripe_1" } },
        },
        {
          id: "n2",
          name: "Find Customer in Notion",
          type: "n8n-nodes-base.notion",
          parameters: {
            resource: "databasePage",
            operation: "getAll",
            filter: { email: "={{$json.customer_email}}" },
          },
          credentials: { notionApi: { id: "cred_notion_1" } },
        },
        {
          id: "n3",
          name: "Update Subscription Status",
          type: "n8n-nodes-base.notion",
          parameters: {
            resource: "databasePage",
            operation: "update",
            fields: { status: "Active" },
          },
          credentials: { notionApi: { id: "cred_notion_1" } },
        },
        {
          id: "n4",
          name: "Notify Sales (Slack)",
          type: "n8n-nodes-base.slack",
          parameters: {
            operation: "post",
            channel: "#sales",
            text: "New paying customer",
          },
          credentials: { slackOAuth2Api: { id: "cred_slack_1" } },
        },
      ],
      connections: {
        "Stripe Trigger": {
          main: [
            [
              {
                node: "Find Customer in Notion",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
        "Find Customer in Notion": {
          main: [
            [
              {
                node: "Update Subscription Status",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
        "Update Subscription Status": {
          main: [
            [{ node: "Notify Sales (Slack)", type: "main", index: 0 }],
          ],
        },
      },
    },

    // 3) TECH – GitHub CI failure -> Linear + Slack
    {
      id: "103",
      name: "GitHub CI Failure → Linear Issue Creation",
      active: false,
      createdAt: "2026-02-03T14:00:00.000Z",
      updatedAt: "2026-02-12T18:00:00.000Z",
      tags: ["tech", "devops"],
      __demo: { destination: "Slack" },
      nodes: [
        {
          id: "n1",
          name: "GitHub Webhook",
          type: "n8n-nodes-base.githubTrigger",
          parameters: { events: ["workflow_run"] },
          credentials: { githubOAuth2Api: { id: "cred_github_1" } },
        },
        {
          id: "n2",
          name: "Check CI Status",
          type: "n8n-nodes-base.if",
          parameters: {
            rules: [
              {
                field: "conclusion",
                operation: "equals",
                value: "failure",
              },
            ],
          },
        },
        {
          id: "n3",
          name: "Create Linear Issue",
          type: "n8n-nodes-base.linear",
          parameters: {
            operation: "create",
            title: "CI failed on main",
            teamId: "TEAM_1",
          },
          credentials: { linearApi: { id: "cred_linear_1" } },
        },
        {
          id: "n4",
          name: "Notify Dev Channel",
          type: "n8n-nodes-base.slack",
          parameters: {
            operation: "post",
            channel: "#dev",
            text: "CI failed → issue created in Linear",
          },
          credentials: { slackOAuth2Api: { id: "cred_slack_1" } },
        },
      ],
      connections: {
        "GitHub Webhook": {
          main: [
            [{ node: "Check CI Status", type: "main", index: 0 }],
          ],
        },
        "Check CI Status": {
          main: [
            [{ node: "Create Linear Issue", type: "main", index: 0 }],
            [],
          ],
        },
        "Create Linear Issue": {
          main: [
            [{ node: "Notify Dev Channel", type: "main", index: 0 }],
          ],
        },
      },
    },

    // 4) AI CONTENT – OpenAI -> SEO -> WordPress -> Slack
    {
      id: "104",
      name: "AI Blog Generator → SEO → Publish",
      active: true,
      createdAt: "2026-02-08T09:00:00.000Z",
      updatedAt: "2026-02-12T13:45:00.000Z",
      tags: ["ai", "marketing", "content"],
      __demo: { destination: "Slack" },
      nodes: [
        {
          id: "n1",
          name: "Content Brief Webhook",
          type: "n8n-nodes-base.webhook",
          parameters: { path: "content-brief", httpMethod: "POST" },
        },
        {
          id: "n2",
          name: "Generate Article (OpenAI)",
          type: "n8n-nodes-base.openai",
          parameters: {
            operation: "chat",
            model: "gpt-4o-mini",
            prompt: "={{$json.brief}}",
          },
          credentials: { openAiApi: { id: "cred_openai_1" } },
        },
        {
          id: "n3",
          name: "SEO Keyword Extraction",
          type: "n8n-nodes-base.function",
          parameters: { code: "return items;" },
        },
        {
          id: "n4",
          name: "Publish to WordPress",
          type: "n8n-nodes-base.wordpress",
          parameters: {
            operation: "create",
            title: "={{$json.title}}",
            status: "draft",
          },
          credentials: { wordpressApi: { id: "cred_wp_1" } },
        },
        {
          id: "n5",
          name: "Notify Marketing",
          type: "n8n-nodes-base.slack",
          parameters: {
            operation: "post",
            channel: "#marketing",
            text: "Draft ready in WordPress",
          },
          credentials: { slackOAuth2Api: { id: "cred_slack_1" } },
        },
      ],
      connections: {
        "Content Brief Webhook": {
          main: [
            [
              {
                node: "Generate Article (OpenAI)",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
        "Generate Article (OpenAI)": {
          main: [
            [
              {
                node: "SEO Keyword Extraction",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
        "SEO Keyword Extraction": {
          main: [
            [
              {
                node: "Publish to WordPress",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
        "Publish to WordPress": {
          main: [
            [{ node: "Notify Marketing", type: "main", index: 0 }],
          ],
        },
      },
    },

    // 5) DUPLICATE A – Marketing report (part 1)
    {
      id: "201",
      name: "Weekly Marketing Report → Slack Digest",
      active: true,
      createdAt: "2026-01-20T09:00:00.000Z",
      updatedAt: "2026-02-11T07:10:00.000Z",
      tags: ["marketing", "reporting"],
      __demo: {
        duplicateGroup: "dup_marketing_report_1",
        duplicateHint: "Same logic as wf 202 with minor text changes",
        destination: "Slack",
      },
      nodes: [
        {
          id: "n1",
          name: "Cron Weekly",
          type: "n8n-nodes-base.cron",
          parameters: { schedule: "0 8 * * 1" },
        },
        {
          id: "n2",
          name: "Fetch GA4 Metrics",
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            url: "https://analytics.example.com/ga4/metrics",
            method: "GET",
          },
        },
        {
          id: "n3",
          name: "Format Digest",
          type: "n8n-nodes-base.function",
          parameters: { code: "return items;" },
        },
        {
          id: "n4",
          name: "Post to Slack",
          type: "n8n-nodes-base.slack",
          parameters: {
            channel: "#marketing",
            text: "Weekly report: ...",
          },
          credentials: { slackOAuth2Api: { id: "cred_slack_1" } },
        },
      ],
      connections: {
        "Cron Weekly": {
          main: [
            [{ node: "Fetch GA4 Metrics", type: "main", index: 0 }],
          ],
        },
        "Fetch GA4 Metrics": {
          main: [
            [{ node: "Format Digest", type: "main", index: 0 }],
          ],
        },
        "Format Digest": {
          main: [[{ node: "Post to Slack", type: "main", index: 0 }]],
        },
      },
    },

    // 6) DUPLICATE B – same workflow with tiny diffs (duplication testing)
    {
      id: "202",
      name: "Weekly Marketing Report → Slack Digest (Copy)",
      active: true,
      createdAt: "2026-01-21T09:05:00.000Z",
      updatedAt: "2026-02-11T07:11:00.000Z",
      tags: ["marketing", "reporting"],
      __demo: {
        duplicateGroup: "dup_marketing_report_1",
        duplicateHint:
          "Duplicate of wf 201: same node types & connections; name differs",
        destination: "Slack",
        health: "warning",
      },
      nodes: [
        {
          id: "n1",
          name: "Cron Weekly",
          type: "n8n-nodes-base.cron",
          parameters: { schedule: "0 8 * * 1" },
        },
        {
          id: "n2",
          name: "Fetch GA4 Metrics",
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            url: "https://analytics.example.com/ga4/metrics",
            method: "GET",
          },
        },
        {
          id: "n3",
          name: "Format Digest",
          type: "n8n-nodes-base.function",
          parameters: { code: "return items;" },
        },
        {
          id: "n4",
          name: "Post to Slack",
          type: "n8n-nodes-base.slack",
          parameters: {
            channel: "#marketing",
            text: "Weekly report (same content)...",
          },
          credentials: { slackOAuth2Api: { id: "cred_slack_1" } },
        },
      ],
      connections: {
        "Cron Weekly": {
          main: [
            [{ node: "Fetch GA4 Metrics", type: "main", index: 0 }],
          ],
        },
        "Fetch GA4 Metrics": {
          main: [
            [{ node: "Format Digest", type: "main", index: 0 }],
          ],
        },
        "Format Digest": {
          main: [[{ node: "Post to Slack", type: "main", index: 0 }]],
        },
      },
    },

    // 7) ERROR WORKFLOW – intentionally broken (Urgent / Critical in Overview)
    {
      id: "999",
      name: "Broken: CRM Sync (for error detection tests)",
      active: true,
      createdAt: "2026-02-12T10:00:00.000Z",
      updatedAt: "2026-02-13T08:00:00.000Z",
      tags: ["broken", "crm"],
      lastExecutionStatus: "error",
      lastExecutionDate: "2026-02-13T08:00:00.000Z",
      __demo: {
        destination: "Slack",
        health: "broken",
        expectedErrors: [
          "Missing credentials for Salesforce node",
          "Connections reference a non-existent node",
          "Webhook trigger missing required parameters (path/httpMethod)",
        ],
      },
      nodes: [
        {
          id: "n1",
          name: "Webhook Trigger (Broken)",
          type: "n8n-nodes-base.webhook",
          parameters: { path: "", httpMethod: "" },
          notes: "Intentionally empty path/method",
        },
        {
          id: "n2",
          name: "Upsert Salesforce Lead (Missing Creds)",
          type: "n8n-nodes-base.salesforce",
          parameters: { resource: "lead", operation: "upsert" },
        },
        {
          id: "n3",
          name: "Notify Ops",
          type: "n8n-nodes-base.slack",
          parameters: { channel: "#ops", text: "Sync done" },
          credentials: { slackOAuth2Api: { id: "cred_slack_1" } },
        },
      ],
      connections: {
        "Webhook Trigger (Broken)": {
          main: [
            [
              {
                node: "Upsert Salesforce Lead (Missing Creds)",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
        "Upsert Salesforce Lead (Missing Creds)": {
          main: [
            [
              { node: "Notify Ops", type: "main", index: 0 },
              { node: "NonExistent Node", type: "main", index: 0 },
            ],
          ],
        },
      },
    },

    // 8) Second HubSpot – CRM sync
    {
      id: "105",
      name: "CRM Sync – Update company records in HubSpot",
      active: true,
      createdAt: "2026-02-01T08:00:00.000Z",
      updatedAt: "2026-02-14T12:00:00.000Z",
      tags: ["sales", "crm"],
      __demo: { destination: "HubSpot", health: "ok" },
      triggerType: "cron",
      hasPublicWebhook: false,
      lastExecutionStatus: "success",
      lastExecutionDate: "2026-02-16T06:00:00Z",
      nodes: [
        { id: "n1", name: "Schedule Daily", type: "n8n-nodes-base.cron", parameters: { rule: { interval: [{ field: "hours", hoursInterval: 24 }] } } },
        { id: "n2", name: "Fetch Airtable Records", type: "n8n-nodes-base.airtable", parameters: { operation: "read", base: "crm", table: "Companies" } },
        { id: "n3", name: "Transform", type: "n8n-nodes-base.function", parameters: { code: "return items;" } },
        { id: "n4", name: "Update HubSpot Company", type: "n8n-nodes-base.hubspot", parameters: { resource: "company", operation: "update" }, credentials: { hubspotOAuth2Api: { id: "cred_hubspot_1" } } },
      ],
      connections: {
        "Schedule Daily": { main: [[{ node: "Fetch Airtable Records", type: "main", index: 0 }]] },
        "Fetch Airtable Records": { main: [[{ node: "Transform", type: "main", index: 0 }]] },
        "Transform": { main: [[{ node: "Update HubSpot Company", type: "main", index: 0 }]] },
      },
    },

    // 9) Second Airtable – content calendar
    {
      id: "106",
      name: "Content Calendar – Publish dates to Airtable",
      active: true,
      createdAt: "2026-02-05T09:00:00.000Z",
      updatedAt: "2026-02-14T10:00:00.000Z",
      tags: ["marketing", "content"],
      __demo: { destination: "Airtable", health: "ok" },
      triggerType: "webhook",
      hasPublicWebhook: false,
      lastExecutionStatus: "success",
      lastExecutionDate: "2026-02-15T14:00:00Z",
      nodes: [
        { id: "n1", name: "Webhook – Brief", type: "n8n-nodes-base.webhook", parameters: { path: "content-brief", httpMethod: "POST" } },
        { id: "n2", name: "Create Airtable Record", type: "n8n-nodes-base.airtable", parameters: { base: "content", table: "Calendar", operation: "create" } },
      ],
      connections: {
        "Webhook – Brief": { main: [[{ node: "Create Airtable Record", type: "main", index: 0 }]] },
      },
    },

    // 10) Google Sheets – report
    {
      id: "107",
      name: "Weekly Report → Google Sheets",
      active: true,
      createdAt: "2026-01-25T10:00:00.000Z",
      updatedAt: "2026-02-12T09:00:00.000Z",
      tags: ["operations", "reporting"],
      __demo: { destination: "Google Sheets", health: "ok" },
      triggerType: "cron",
      hasPublicWebhook: false,
      lastExecutionStatus: "success",
      lastExecutionDate: "2026-02-16T08:00:00Z",
      nodes: [
        { id: "n1", name: "Cron Weekly", type: "n8n-nodes-base.cron", parameters: { schedule: "0 9 * * 1" } },
        { id: "n2", name: "Fetch Metrics", type: "n8n-nodes-base.httpRequest", parameters: { url: "https://api.example.com/metrics", method: "GET" } },
        { id: "n3", name: "Append to Google Sheets", type: "n8n-nodes-base.googleSheets", parameters: { operation: "append", sheetId: "sheet1" }, credentials: { googleSheetsOAuth2Api: { id: "cred_sheets_1" } } },
      ],
      connections: {
        "Cron Weekly": { main: [[{ node: "Fetch Metrics", type: "main", index: 0 }]] },
        "Fetch Metrics": { main: [[{ node: "Append to Google Sheets", type: "main", index: 0 }]] },
      },
    },

    // 11) Google Sheets – data export (warning)
    {
      id: "108",
      name: "Data Export to Google Sheets",
      active: true,
      createdAt: "2026-02-01T11:00:00.000Z",
      updatedAt: "2026-02-10T16:00:00.000Z",
      tags: ["data", "export"],
      __demo: { destination: "Google Sheets", health: "warning" },
      triggerType: "manual",
      hasPublicWebhook: false,
      lastExecutionStatus: "success",
      lastExecutionDate: "2026-01-20T10:00:00Z",
      nodes: [
        { id: "n1", name: "Manual Trigger", type: "n8n-nodes-base.manualTrigger" },
        { id: "n2", name: "Read Database", type: "n8n-nodes-base.postgres", parameters: { operation: "executeQuery" } },
        { id: "n3", name: "Write to Google Sheets", type: "n8n-nodes-base.googleSheets", parameters: { operation: "append" }, credentials: { googleSheetsOAuth2Api: { id: "cred_sheets_1" } } },
      ],
      connections: {
        "Manual Trigger": { main: [[{ node: "Read Database", type: "main", index: 0 }]] },
        "Read Database": { main: [[{ node: "Write to Google Sheets", type: "main", index: 0 }]] },
      },
    },

    // 12) Mailchimp – newsletter
    {
      id: "109",
      name: "Newsletter Signup → Mailchimp",
      active: true,
      createdAt: "2026-02-08T14:00:00.000Z",
      updatedAt: "2026-02-15T11:00:00.000Z",
      tags: ["marketing", "email"],
      __demo: { destination: "Mailchimp", health: "warning" },
      triggerType: "webhook",
      hasPublicWebhook: true,
      lastExecutionStatus: "success",
      lastExecutionDate: "2026-02-16T12:00:00Z",
      nodes: [
        { id: "n1", name: "Webhook – Signup", type: "n8n-nodes-base.webhook", parameters: { path: "newsletter-signup", httpMethod: "POST" } },
        { id: "n2", name: "Add to Mailchimp List", type: "n8n-nodes-base.mailchimp", parameters: { resource: "list", operation: "add" }, credentials: { mailchimpApi: { id: "cred_mailchimp_1" } } },
      ],
      connections: {
        "Webhook – Signup": { main: [[{ node: "Add to Mailchimp List", type: "main", index: 0 }]] },
      },
    },
  ];

// Make workflows (2 workflows with Make-specific node types)
const MAKE_DEMO_WORKFLOWS: DemoWorkflowRaw[] = [
  // 1) Make workflow - E-commerce order processing
  {
    id: "301",
    name: "Shopify Order → Airtable → Email Confirmation",
    active: true,
    createdAt: "2026-02-05T11:00:00.000Z",
    updatedAt: "2026-02-15T14:30:00.000Z",
    tags: ["ecommerce", "crm"],
    __demo: { destination: "Airtable", health: "optimizable" },
    triggerType: "webhook",
    hasPublicWebhook: true,
    lastExecutionStatus: "success",
    lastExecutionDate: "2026-02-15T22:00:00Z",
    nodes: [
      {
        id: "m1",
        name: "Shopify Webhook",
        type: "make.webhook",
        parameters: { path: "order-created", method: "POST" },
      },
      {
        id: "m2",
        name: "Create Record in Airtable",
        type: "make.airtable",
        parameters: {
          base: "orders",
          table: "Orders",
          operation: "create",
        },
      },
      {
        id: "m3",
        name: "Send Email via SendGrid",
        type: "make.sendgrid",
        parameters: {
          operation: "send",
          to: "={{$json.customer_email}}",
          subject: "Order Confirmation",
        },
      },
    ],
    connections: {
      "Shopify Webhook": {
        main: [[{ node: "Create Record in Airtable", type: "main", index: 0 }]],
      },
      "Create Record in Airtable": {
        main: [[{ node: "Send Email via SendGrid", type: "main", index: 0 }]],
      },
    },
  },

  // 2) Make workflow - Social media automation
  {
    id: "302",
    name: "Twitter Mention → Slack Alert → Notion Log",
    active: true,
    createdAt: "2026-02-10T09:15:00.000Z",
    updatedAt: "2026-02-18T16:20:00.000Z",
    tags: ["social", "monitoring"],
    __demo: { destination: "Notion" },
    triggerType: "webhook",
    hasPublicWebhook: false,
    lastExecutionStatus: "success",
    lastExecutionDate: "2026-02-18T14:00:00Z",
    nodes: [
      {
        id: "m1",
        name: "Twitter Trigger",
        type: "make.twitter",
        parameters: { event: "mention", account: "main" },
      },
      {
        id: "m2",
        name: "Post to Slack Channel",
        type: "make.slack",
        parameters: {
          channel: "#mentions",
          text: "New mention: {{$json.text}}",
        },
      },
      {
        id: "m3",
        name: "Add to Notion Database",
        type: "make.notion",
        parameters: {
          database: "mentions_db",
          operation: "create",
        },
      },
    ],
    connections: {
      "Twitter Trigger": {
        main: [[{ node: "Post to Slack Channel", type: "main", index: 0 }]],
      },
      "Post to Slack Channel": {
        main: [[{ node: "Add to Notion Database", type: "main", index: 0 }]],
      },
    },
  },
];

// ─── Mapper: DemoWorkflowRaw → Workflow ──────────────────────────────────────

function toDashboardWorkflow(
  raw: DemoWorkflowRaw,
  provider: "n8n" | "make",
  connectionId: string
): WorkflowWithEnrichmentFields {
  // Convert raw nodes to WorkflowGraph format
  const graphNodes: WorkflowGraphNode[] = raw.nodes.map((n) => {
    const typeLower = n.type.toLowerCase();
    let kind: "trigger" | "action" | "router" | "other" = "other";
    if (typeLower.includes("trigger") || typeLower.includes("webhook")) {
      kind = "trigger";
    } else if (typeLower.includes("if") || typeLower.includes("switch") || typeLower.includes("router")) {
      kind = "router";
    } else if (!typeLower.includes("trigger")) {
      kind = "action";
    }

    return {
      id: n.id,
      label: n.name,
      kind,
      type: n.type,
    };
  });

  // Convert raw connections to WorkflowGraph edges
  // Create mapping from node name to node ID
  const nameToId = new Map<string, string>();
  for (const node of graphNodes) {
    // Find the original node by matching label to name
    const originalNode = raw.nodes.find((n) => (n.name ?? "") === node.label);
    if (originalNode) {
      const originalName = originalNode.name ?? "";
      nameToId.set(originalName, node.id);
    }
  }

  const graphEdges: WorkflowGraphEdge[] = [];
  const connections = raw.connections as Record<string, {
    main?: Array<Array<{ node: string; type: string; index: number }>>;
  }> | undefined;

  if (connections) {
    for (const [sourceNodeName, conn] of Object.entries(connections)) {
      const sourceId = nameToId.get(sourceNodeName);
      if (!sourceId) continue;
      
      const mainConnections = conn.main ?? [];
      for (const slot of mainConnections) {
        for (const edge of slot) {
          const targetId = nameToId.get(edge.node);
          if (targetId) {
            graphEdges.push({
              from: sourceId,
              to: targetId,
            });
          }
        }
      }
    }
  }

  const graph: WorkflowGraph = {
    nodes: graphNodes,
    edges: graphEdges,
  };

  return {
    id: raw.id,
    name: raw.name,
    active: raw.active,
    provider,
    connectionId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    graph,
    // Preserve enrichment fields from raw data
    triggerType: raw.triggerType,
    nodesCount: raw.nodes.length,
    hasPublicWebhook: raw.hasPublicWebhook,
    lastExecutionStatus: raw.lastExecutionStatus,
    lastExecutionDate: raw.lastExecutionDate,
    outputDestination: raw.__demo?.destination,
    healthOverride: raw.__demo?.health,
  };
}

// ─── Combined Demo Workflows ───────────────────────────────────────────────────

/**
 * Curated 10-workflow set for demo dashboard.
 * Distribution: HubSpot 2, Slack 2, Airtable 2, Google Sheets 2, Notion 1, Mailchimp 1
 * Health: ok ×5, optimizable ×2, warning ×2, broken ×1
 *
 * N8N indices: 0=101(HubSpot), 1=102(Slack), 6=999(Slack/broken),
 *   7=105(HubSpot), 8=106(Airtable), 9=107(GSheets), 10=108(GSheets), 11=109(Mailchimp)
 * Make indices: 0=301(Airtable), 1=302(Notion)
 */
const N8N_DEMO_INDICES = [0, 1, 6, 7, 8, 9, 10, 11];
const MAKE_DEMO_INDICES = [0, 1];

/** Typed workflows ready for the dashboard UI.
 * Includes workflows for HubSpot, Slack, Airtable, Google Sheets, Notion, Mailchimp.
 * Health mix: 1 broken, 2 warning, 1 optimizable, rest ok.
 */
export const DEMO_WORKFLOWS: WorkflowWithEnrichmentFields[] = [
  ...N8N_DEMO_INDICES.map((i) =>
    toDashboardWorkflow(N8N_DEMO_WORKFLOWS[i], "n8n", DEMO_CONNECTION_N8N)
  ),
  ...MAKE_DEMO_INDICES.map((i) =>
    toDashboardWorkflow(MAKE_DEMO_WORKFLOWS[i], "make", DEMO_CONNECTION_MAKE)
  ),
];
