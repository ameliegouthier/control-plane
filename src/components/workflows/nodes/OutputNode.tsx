import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NodeCard } from "./NodeCard";

export function OutputNode({ data }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <NodeCard
        themeKey="output"
        label={data.label as string}
        service={data.service as string | undefined}
        operation={data.operation as string | undefined}
        aiSummary={data.aiSummary as string | null | undefined}
      />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </>
  );
}
