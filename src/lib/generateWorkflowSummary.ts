import OpenAI from "openai";

const NODE_SYSTEM_PROMPT =
  "Tu es un assistant qui décrit en une courte phrase (max 8 mots, commençant par un verbe d'action à l'infinitif) ce qu'un node d'automatisation fait concrètement. Sois précis et humain. Exemples : 'Reçoit une requête entrante via webhook', 'Ajoute le contact dans Airtable', 'Envoie une notification sur Slack', 'Crée une page dans Notion'.";

const SYSTEM_PROMPT =
  "Résume en maximum 8 mots, en commençant par un verbe d'action. Sois concis et direct. Exemples : 'Ajoute des leads depuis Typeform', 'Envoie une alerte via webhook', 'Synchronise les contacts HubSpot'.";

export async function generateWorkflowSummary(
  workflow: any,
  resourceName: string,
  maxWords = 12
): Promise<string> {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const nodes: string[] = (workflow.workflowNodes ?? workflow.nodes ?? []).map(
      (n: any) => n.name ?? n.type ?? n.id ?? "unknown"
    );

    const userMessage = `Workflow : "${workflow.name}"\nRessource : "${resourceName}"\nNodes : ${nodes.length > 0 ? nodes.join(", ") : "aucun"}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 40,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() ?? workflow.name;
  } catch {
    return workflow.name;
  }
}

export async function generateNodeSummary(
  node: { type: string; name?: string | null; config?: unknown },
  workflowName: string
): Promise<string> {
  const fallback = node.name ?? node.type;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const cfg = node.config && typeof node.config === "object"
      ? (node.config as Record<string, unknown>)
      : {};
    const service: string = (cfg.service as string | undefined) ?? node.type;
    const action: string = (cfg.operation as string | undefined) ?? (cfg.action as string | undefined) ?? "";
    const kind: string = (cfg.kind as string | undefined) ?? "";

    const parts = [
      `Workflow : "${workflowName}"`,
      `Service : "${service}"`,
      ...(action ? [`Action : "${action}"`] : []),
      ...(kind ? [`Kind : "${kind}"`] : []),
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: NODE_SYSTEM_PROMPT },
        { role: "user", content: parts.join("\n") },
      ],
      max_tokens: 40,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() ?? fallback;
  } catch {
    return fallback;
  }
}
