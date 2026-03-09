/**
 * Notion resource extraction for workflow nodes.
 * n8n can store database ID in different parameter shapes.
 */

/** Node-like object with optional parameters (n8n node or legacy raw node). */
export interface NodeWithParameters {
  parameters?: Record<string, unknown>;
}

/**
 * Extract Notion database ID from a node's parameters.
 * Checks common n8n locations: databaseId, databaseId.value, database_id.
 *
 * @param node - Node with optional parameters (e.g. n8n node or { parameters }).
 * @returns The database ID string when found, otherwise undefined.
 */
export function extractNotionDatabaseId(
  node: NodeWithParameters
): string | undefined {
  const params = node.parameters ?? {};

  // parameters.databaseId (string)
  const databaseId = params.databaseId;
  if (typeof databaseId === "string" && databaseId.trim()) {
    return databaseId.trim();
  }

  // parameters.databaseId.value (n8n expression/value object)
  if (
    databaseId != null &&
    typeof databaseId === "object" &&
    "value" in databaseId
  ) {
    const value = (databaseId as { value: unknown }).value;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  // parameters.database_id (snake_case)
  const databaseIdSnake = params.database_id;
  if (typeof databaseIdSnake === "string" && databaseIdSnake.trim()) {
    return databaseIdSnake.trim();
  }

  return undefined;
}
