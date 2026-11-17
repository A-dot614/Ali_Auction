import { GraphQLError, Kind, type ValidationRule } from "graphql";

/**
 * D10 (Slice 10): placeholder GraphQL depth limit.
 * NOT FOR PRODUCTION; docs/16 does not cover this value.
 */

export const DEPTH_LIMIT_CODE = "GRAPHQL_DEPTH_LIMIT";

function selectionDepth(selectionSet: any, current: number): number {
  let max = current;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD && selection.selectionSet) {
      max = Math.max(max, selectionDepth(selection.selectionSet, current + 1));
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      max = Math.max(max, selectionDepth(selection.selectionSet, current));
    }
  }
  return max;
}

export function depthLimitRule(maxDepth: number): ValidationRule {
  return (context) => ({
    OperationDefinition(node) {
      const depth = selectionDepth(node.selectionSet, 0);
      if (depth > maxDepth) {
        context.reportError(
          new GraphQLError(`${DEPTH_LIMIT_CODE}: Query exceeds maximum depth of ${maxDepth}.`, { nodes: [node] })
        );
      }
    },
  });
}

/** Production errors keep only the message and stable code; no stack trace or exception data. */
export function productionFormatError(error: Readonly<GraphQLError | Error>) {
  const gqlError = error as GraphQLError;
  const code = (gqlError.extensions?.code as string) ?? "INTERNAL_ERROR";
  return new GraphQLError(gqlError.message, { extensions: { code } });
}
