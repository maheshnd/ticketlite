// OpenSearch client for the functions. In AWS every request is signed with SigV4 using the Lambda role's
// credentials (the domain's access policy allows only our roles). Locally (Docker) it's plain HTTP.
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws-v3";

export function createSearchClient(endpoint: string): Client {
  if (endpoint.startsWith("http://")) return new Client({ node: endpoint });
  return new Client({
    ...AwsSigv4Signer({
      region: process.env.AWS_REGION ?? "us-east-1",
      service: "es",
      getCredentials: defaultProvider(),
    }),
    node: endpoint,
    requestTimeout: 3000, // CONCEPT: timeout-chain
  });
}
