import { webConfig } from "./config";

/**
 * Browser GraphQL client. Credentials are included so the API's HttpOnly cookie
 * session is used. The web app never reads, stores, or forwards a session token;
 * it never uses browser token storage APIs (D5, rule 3).
 */
export async function gql<T = any>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<{ data: T | null; errors: Array<{ message: string }> }> {
  const response = await fetch(`${webConfig.apiOrigin}/graphql`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
}

export function currentUserQuery(): string {
  return `query { me { id email status emailVerified roles } }`;
}
