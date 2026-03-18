export type AIAdvisorInput = {
  services: string[];
  connections: string[];
  signals: string[];
};

export type AIAdvisorWorkflowInput = {
  workflowId: string;
  workflowName: string;
  nodes: { service: string; operation: string; kind: string }[];
  signals: string[];
};

export type WorkflowInsightResult = {
  type: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  fix: string;
};

const WORKFLOW_SYSTEM_PROMPT = `You are an expert in automation systems (n8n, Make, Zapier).
Analyze the workflow and return a JSON array of insights. Each insight must have:
- type: string (e.g. "redundancy", "error_handling", "performance", "security")
- severity: "low" | "medium" | "high"
- title: string (max 8 words)
- description: string (1-2 sentences)
- fix: string (1 concrete action)

Return ONLY the JSON array, no markdown, no text around it.
If no issues are found, return an empty array [].`;

function buildAIContext(input: AIAdvisorInput): string {
  return `
You are an expert in automation systems such as n8n, Make, Zapier and automation architectures.

Analyze the following automation system.

SERVICES:
${input.services.join(", ")}

CONNECTIONS:
${input.connections.join("\n")}

SIGNALS DETECTED:
${input.signals.join("\n")}

Your goal is to optimize the automation system.

Focus ONLY on:
- redundant workflows
- duplicated destinations
- unnecessary intermediate systems
- long automation chains
- simplification opportunities

Avoid generic advice such as documentation, dashboards, team processes, or governance.

Your recommendations must reference the actual services in the system.

Return the analysis in the following format:

SYSTEM RISKS
(short bullet points describing architecture risks)

AUTOMATION IMPROVEMENTS
(concrete improvements to the workflows)

SIMPLIFICATION OPPORTUNITIES
(specific opportunities to reduce steps or systems)

Keep the answer concise and actionable.
`;
}

function buildWorkflowContext(input: AIAdvisorWorkflowInput): string {
  const nodeLines = input.nodes
    .map((n) => `- ${n.kind}: ${n.service} / ${n.operation}`)
    .join("\n");

  const signalLines = input.signals.length > 0
    ? input.signals.join("\n")
    : "None";

  return `Workflow: "${input.workflowName}"

Nodes:
${nodeLines}

Signals:
${signalLines}`;
}

export async function runAIAdvisor(
  input: AIAdvisorInput,
  options?: { baseUrl?: string },
): Promise<{ result?: string; error?: string }> {
  const prompt = buildAIContext(input);
  const baseUrl = options?.baseUrl ?? "";
  const url = `${baseUrl}/api/ai`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  const data = (await response.json()) as { result?: string; error?: string } & Record<string, unknown>;
  return data;
}

export async function runWorkflowAdvisor(
  input: AIAdvisorWorkflowInput,
  options?: { baseUrl?: string },
): Promise<WorkflowInsightResult[]> {
  const userPrompt = buildWorkflowContext(input);
  const baseUrl = options?.baseUrl ?? "";
  const url = `${baseUrl}/api/ai`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ systemPrompt: WORKFLOW_SYSTEM_PROMPT, prompt: userPrompt }),
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { result?: string; error?: string };
  if (!data.result) return [];

  try {
    const parsed = JSON.parse(data.result) as WorkflowInsightResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
