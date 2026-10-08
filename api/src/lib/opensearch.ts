// OpenSearch client for the API, created once, only when search is enabled (OPENSEARCH_ENDPOINT set).
// Requests to the AWS domain are signed with SigV4 using the Lambda role. CONCEPT: sigv4
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws-v3";
import { config } from "../config";

let client: Client | undefined;

export function getSearchClient(): Client | undefined {
  const endpoint = config.opensearchEndpoint;
  if (!endpoint) return undefined;
  client ??= endpoint.startsWith("http://")
    ? new Client({ node: endpoint }) // local Docker, no auth
    : new Client({
        ...AwsSigv4Signer({ region: config.region, service: "es", getCredentials: defaultProvider() }),
        node: endpoint,
        requestTimeout: 2000, // CONCEPT: timeout-chain
      });
  return client;
}
