import {
  type Workflow,
  type WorkflowNode,
  type Connections,
  getTriggerNode,
  getTriggerSummary,
  getSignals,
  formatNodeType,
} from "../app/workflow-helpers";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowIntent {
  summary: string;
  problemSolved: string;
  input: string;
  processing: string;
  output: string;
  category: string;
  tags: string[];
}

// ─── Main generator ─────────────────────────────────────────────────────────

export function generateDraftIntent(workflow: Workflow): WorkflowIntent {
  const trigger = getTriggerNode(workflow.nodes);
  const triggerInfo = getTriggerSummary(workflow.nodes);
  const signals = getSignals(workflow.nodes, workflow.connections);
  const actionNodes = getOrderedActions(
    workflow.nodes,
    workflow.connections,
    trigger
  );
  const leafNodes = getLeafNodes(workflow.nodes, workflow.connections);
  const actionLabels = actionNodes.map((n) => formatNodeType(n.type));

  const input = deriveInput(triggerInfo.kind, trigger);
  const output = deriveOutput(leafNodes, actionNodes);
  const processing = deriveProcessing(actionLabels, signals.hasBranching);
  const category = deriveCategory(triggerInfo.kind, actionNodes);
  const problemSolved = deriveProblem(category, triggerInfo.kind, workflow.name);
  const tags = deriveTags(triggerInfo.kind, actionNodes);

  const summary = [input, processing.toLowerCase(), output.toLowerCase()]
    .filter(Boolean)
    .join(", then ");

  return { summary, problemSolved, input, processing, output, category, tags };
}

// ─── Input heuristic ────────────────────────────────────────────────────────

function deriveInput(
  kind: string,
  trigger: WorkflowNode | null
): string {
  const params = trigger?.parameters ?? {};

  if (kind === "webhook") {
    const path = typeof params.path === "string" && params.path ? params.path : "";
    const method = typeof params.httpMethod === "string" ? params.httpMethod : "";
    const detail = path || method || "incoming request";
    return `Webhook • ${detail}`;
  }

  if (kind === "schedule") {
    const cadence = readScheduleCadence(params);
    return `Schedule • ${cadence}`;
  }

  if (kind === "manual") return "Manual trigger";

  // Other trigger types
  if (trigger) {
    return `${formatNodeType(trigger.type)} trigger`;
  }
  return "Manual trigger";
}

/** Read a human cadence string from schedule trigger parameters */
function readScheduleCadence(params: Record<string, unknown>): string {
  const rule = params.rule as Record<string, unknown> | undefined;
  if (rule) {
    const intervals = rule.interval as Array<Record<string, unknown>> | undefined;
    if (intervals?.[0]) {
      const f = intervals[0].field as string | undefined;
      if (f === "seconds") {
        const v = intervals[0].secondsInterval ?? 30;
        return `every ${v} seconds`;
      }
      if (f === "minutes") {
        const v = intervals[0].minutesInterval ?? 5;
        return v === 1 ? "every minute" : `every ${v} minutes`;
      }
      if (f === "hours") {
        const v = intervals[0].hoursInterval ?? 1;
        return v === 1 ? "every hour" : `every ${v} hours`;
      }
      if (f === "days") return "daily";
      if (f === "weeks") return "weekly";
      if (f === "cronExpression") {
        return `cron ${intervals[0].expression ?? "…"}`;
      }
    }
  }
  if (typeof params.cronExpression === "string")
    return `cron ${params.cronExpression}`;
  return "recurring";
}

// ─── Output heuristic ───────────────────────────────────────────────────────

/** Notification-style nodes that produce a secondary output */
const NOTIFY_PATTERNS: [string, string][] = [
  ["gmail", "Notifies via Email"],
  ["slack", "Notifies via Slack"],
  ["telegram", "Notifies via Telegram"],
  ["discord", "Notifies via Discord"],
  ["sendgrid", "Notifies via Email"],
  ["twilio", "Notifies via SMS"],
];

/** Primary data/action outputs (checked on leaf nodes first, then all actions) */
const PRIMARY_OUTPUT_RULES: [string, (node: WorkflowNode) => string][] = [
  ["respondtowebhook", () => "Returns an HTTP JSON response"],
  ["airtable", deriveAirtableOutput],
  ["hubspot", deriveGenericCrudOutput("HubSpot")],
  ["notion", deriveGenericCrudOutput("Notion")],
  ["googlesheets", () => "Writes to Google Sheets"],
  ["sheets", () => "Writes to Google Sheets"],
  ["salesforce", deriveGenericCrudOutput("Salesforce")],
  ["postgres", () => "Writes to Postgres"],
  ["mysql", () => "Writes to MySQL"],
  ["mongodb", () => "Writes to MongoDB"],
  ["httprequest", () => "Calls an external API"],
  ["openai", () => "Calls OpenAI"],
  ["set", () => "Produces structured data"],
  ["code", () => "Runs custom code"],
];

function deriveOutput(
  leafNodes: WorkflowNode[],
  allActions: WorkflowNode[]
): string {
  const parts: string[] = [];

  // 1. Find primary output from leaf nodes, fallback to any action node
  const primary = findPrimaryOutput(leafNodes) ?? findPrimaryOutput(allActions);
  if (primary) parts.push(primary);

  // 2. Collect secondary notification outputs from all action nodes
  const notifySeen = new Set<string>();
  for (const node of allActions) {
    const t = node.type.toLowerCase();
    for (const [pattern, label] of NOTIFY_PATTERNS) {
      if (t.includes(pattern) && !notifySeen.has(label)) {
        notifySeen.add(label);
        // Don't duplicate if primary already mentions the same channel
        if (!primary?.toLowerCase().includes(pattern)) {
          parts.push(label);
        }
      }
    }
  }

  return parts.length > 0 ? parts.join("; ") : "Runs automation steps";
}

function findPrimaryOutput(nodes: WorkflowNode[]): string | null {
  for (const node of nodes) {
    const t = node.type.toLowerCase();
    for (const [pattern, derive] of PRIMARY_OUTPUT_RULES) {
      if (t.includes(pattern)) return derive(node);
    }
  }
  return null;
}

/** Airtable: prefer "Creates" vs "Updates" based on operation or node name */
function deriveAirtableOutput(node: WorkflowNode): string {
  const op = detectOperation(node);
  if (op === "create") return "Creates record in Airtable";
  if (op === "update") return "Updates record in Airtable";
  if (op === "upsert") return "Creates/updates record in Airtable";
  if (op === "delete") return "Deletes record in Airtable";
  if (op === "read" || op === "search" || op === "list")
    return "Reads records from Airtable";
  return "Creates/updates record in Airtable";
}

/** Generic CRUD output for services like HubSpot, Notion, Salesforce */
function deriveGenericCrudOutput(
  service: string
): (node: WorkflowNode) => string {
  return (node: WorkflowNode) => {
    const op = detectOperation(node);
    if (op === "create") return `Creates record in ${service}`;
    if (op === "update") return `Updates record in ${service}`;
    if (op === "upsert") return `Creates/updates record in ${service}`;
    if (op === "delete") return `Deletes record in ${service}`;
    if (op === "read" || op === "search" || op === "list")
      return `Reads from ${service}`;
    return `Creates/updates record in ${service}`;
  };
}

/**
 * Detect CRUD operation from node.parameters.operation or node.name.
 * Returns a normalized verb or null.
 */
function detectOperation(node: WorkflowNode): string | null {
  // 1. Check explicit operation parameter
  const op = node.parameters?.operation;
  if (typeof op === "string") {
    const lower = op.toLowerCase();
    if (lower.includes("create") || lower === "append") return "create";
    if (lower.includes("update")) return "update";
    if (lower.includes("upsert")) return "upsert";
    if (lower.includes("delete") || lower.includes("remove")) return "delete";
    if (
      lower.includes("get") ||
      lower.includes("read") ||
      lower.includes("search") ||
      lower.includes("list")
    )
      return "read";
  }
  // 2. Heuristic from node.name
  const name = node.name.toLowerCase();
  if (name.includes("create") || name.includes("add") || name.includes("new"))
    return "create";
  if (name.includes("update") || name.includes("edit") || name.includes("patch"))
    return "update";
  if (name.includes("upsert")) return "upsert";
  if (name.includes("delete") || name.includes("remove")) return "delete";
  return null;
}

// ─── Processing heuristic ───────────────────────────────────────────────────

function deriveProcessing(labels: string[], hasBranching: boolean): string {
  if (labels.length === 0) return "No processing steps";
  const unique = [...new Set(labels)];
  const steps = unique.slice(0, 4).join(", ");
  const suffix = unique.length > 4 ? ` and ${unique.length - 4} more` : "";
  const branch = hasBranching ? ", branches conditionally" : "";
  return `Processes via ${steps}${suffix}${branch}`;
}

// ─── Category heuristic ─────────────────────────────────────────────────────

const APP_CATEGORIES: [string, string][] = [
  ["gmail", "Notifications"],
  ["slack", "Notifications"],
  ["telegram", "Notifications"],
  ["discord", "Notifications"],
  ["hubspot", "CRM / Data sync"],
  ["airtable", "CRM / Data sync"],
  ["notion", "CRM / Data sync"],
  ["salesforce", "CRM / Data sync"],
  ["googlesheets", "CRM / Data sync"],
  ["sheets", "CRM / Data sync"],
  ["openai", "AI / ML"],
  ["postgres", "Data pipeline"],
  ["mysql", "Data pipeline"],
  ["mongodb", "Data pipeline"],
];

function deriveCategory(kind: string, actions: WorkflowNode[]): string {
  // Webhook + respond → API endpoint
  if (
    kind === "webhook" &&
    actions.some((n) => n.type.toLowerCase().includes("respondtowebhook"))
  ) {
    return "API / Webhook endpoint";
  }
  // Check for known app categories
  for (const action of actions) {
    const t = action.type.toLowerCase();
    for (const [pattern, cat] of APP_CATEGORIES) {
      if (t.includes(pattern)) return cat;
    }
  }
  // Schedule + code/if → monitoring
  if (
    kind === "schedule" &&
    actions.some((n) => {
      const t = n.type.toLowerCase();
      return t.includes("code") || t.includes("if");
    })
  ) {
    return "Monitoring / Checks";
  }
  // HTTP requests → integrations
  if (actions.some((n) => n.type.toLowerCase().includes("httprequest"))) {
    return "Integrations";
  }
  if (kind === "webhook") return "API / Webhook endpoint";
  if (kind === "schedule") return "Scheduled task";
  return "Automation";
}

// ─── Problem heuristic ──────────────────────────────────────────────────────

/** Keyword groups → domain-specific problem templates */
const NAME_DOMAIN_RULES: [string[], string][] = [
  [
    ["lead", "marketing", "newsletter", "campaign", "signup", "subscribe", "opt-in", "landing"],
    "Captures and processes marketing leads to grow the pipeline",
  ],
  [
    ["prospect", "sales", "crm", "deal", "pipeline", "outreach", "follow-up", "demo"],
    "Automates sales pipeline activities to close deals faster",
  ],
  [
    ["invoice", "payment", "stripe", "billing", "subscription", "charge", "refund", "receipt"],
    "Handles billing and payment workflows to streamline finance ops",
  ],
  [
    ["onboard", "welcome", "activation", "setup", "getting-started"],
    "Automates user onboarding to improve activation and retention",
  ],
  [
    ["monitor", "health", "alert", "uptime", "status", "check", "watchdog"],
    "Monitors systems and alerts the team when issues are detected",
  ],
  [
    ["sync", "backup", "migrate", "import", "export", "replicate"],
    "Keeps data in sync across systems to maintain a single source of truth",
  ],
  [
    ["support", "ticket", "helpdesk", "issue", "bug"],
    "Automates support workflows to reduce response time",
  ],
];

function deriveProblem(category: string, kind: string, workflowName: string): string {
  // 1. Try matching workflow name keywords for a domain-specific template
  const nameLower = workflowName.toLowerCase();
  for (const [keywords, template] of NAME_DOMAIN_RULES) {
    if (keywords.some((kw) => nameLower.includes(kw))) return template;
  }

  // 2. Fall back to category-based templates
  if (category === "API / Webhook endpoint")
    return "Exposes an HTTP endpoint that processes requests and returns a response";
  if (category === "Notifications")
    return "Automates sending notifications to keep teams informed";
  if (category === "CRM / Data sync")
    return "Keeps external data sources in sync automatically";
  if (category === "AI / ML")
    return "Leverages AI/ML capabilities in an automated pipeline";
  if (category === "Data pipeline")
    return "Moves and transforms data between systems";
  if (category === "Monitoring / Checks")
    return "Periodically checks conditions and takes action";
  if (category === "Integrations")
    return "Connects external services via API calls";
  if (kind === "schedule")
    return "Automates a recurring task on a fixed schedule";
  return "Automates a multi-step process end-to-end";
}

// ─── Tags heuristic ─────────────────────────────────────────────────────────

const KNOWN_APPS = [
  "gmail", "slack", "hubspot", "notion", "airtable", "googlesheets",
  "telegram", "discord", "stripe", "jira", "github", "openai",
  "postgres", "mysql", "mongodb", "salesforce", "twilio", "sendgrid",
  "apollo",
];

function deriveTags(kind: string, actions: WorkflowNode[]): string[] {
  const tags = new Set<string>();
  tags.add(kind);

  // Add key action types (deduplicated)
  const seen = new Set<string>();
  for (const n of actions) {
    const raw = n.type.includes(".") ? n.type.split(".").pop()! : n.type;
    const lower = raw.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    // Known app?
    for (const app of KNOWN_APPS) {
      if (lower.includes(app)) {
        tags.add(app);
        break;
      }
    }
    // Key action types
    if (lower.includes("httprequest")) tags.add("http");
    if (lower.includes("code")) tags.add("code");
    if (lower.includes("if") || lower.includes("switch")) tags.add("branching");
    if (lower.includes("respondtowebhook")) tags.add("api-response");
  }

  // Cap at 6
  return [...tags].slice(0, 6);
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function getOrderedActions(
  nodes: WorkflowNode[],
  connections: Connections,
  trigger: WorkflowNode | null
): WorkflowNode[] {
  const byName = new Map(nodes.map((n) => [n.name, n]));
  const triggerName = trigger?.name;
  const visited = new Set<string>();
  const result: WorkflowNode[] = [];

  function walk(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    const node = byName.get(name);
    if (node && node.name !== triggerName) result.push(node);
    const outs = connections[name]?.main;
    if (!outs) return;
    for (const slot of outs) {
      for (const edge of slot) walk(edge.node);
    }
  }

  if (trigger) walk(trigger.name);
  for (const n of nodes) {
    if (!visited.has(n.name) && n.name !== triggerName) result.push(n);
  }
  return result;
}

function getLeafNodes(
  nodes: WorkflowNode[],
  connections: Connections
): WorkflowNode[] {
  const hasOutgoing = new Set(Object.keys(connections));
  return nodes.filter((n) => !hasOutgoing.has(n.name));
}
