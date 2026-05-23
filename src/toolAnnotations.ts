import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

export type ToolAnnotationKind = "local_read" | "nexus_read" | "safe_write" | "destructive_write";

export function toolAnnotations(title: string, kind: ToolAnnotationKind): ToolAnnotations {
  switch (kind) {
    case "local_read":
      return {
        title,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      };
    case "nexus_read":
      return {
        title,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      };
    case "safe_write":
      return {
        title,
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      };
    case "destructive_write":
      return {
        title,
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      };
  }
}
