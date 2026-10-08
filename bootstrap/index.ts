// One-time bootstrap: creates ONLY what GitHub Actions needs to log in to AWS.
// It is run once from the laptop (see docs/CICD-SETUP.md). Everything else is deployed by CI from infra/.
import "./oidc";
import { previewRole, deployRole } from "./roles";

// Copy these into the GitHub repository variables AWS_PREVIEW_ROLE_ARN and AWS_DEPLOY_ROLE_ARN.
export const previewRoleArn = previewRole.arn;
export const deployRoleArn = deployRole.arn;
