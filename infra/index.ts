// Entry point. It only wires the service files together and exports outputs.
// Importing a file creates the resources declared in it.
import "./iam";
import "./lambda";
import { stage } from "./api";

// Base URL of the API, e.g. https://abc123.execute-api.us-east-1.amazonaws.com
// Try: curl $(pulumi stack output apiUrl)/health
export const apiUrl = stage.invokeUrl;
