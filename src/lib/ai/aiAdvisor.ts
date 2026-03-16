export type AIAdvisorInput = {
  services: string[];
  connections: string[];
  signals: string[];
};

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
