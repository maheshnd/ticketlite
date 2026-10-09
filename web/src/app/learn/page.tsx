// /learn: a small index of the project's study material, handy during demos. Links open the Markdown docs on
// GitHub (the static site doesn't ship the docs themselves).
import { PageHeading } from "../../components/PageHeading";

const REPO = "https://github.com/maheshnd/ticketlite/blob/main";

const docs = [
  ["Architecture diagrams", "docs/ARCHITECTURE.md"],
  ["Concept map (every concept → files → how to see it → how to break it)", "docs/CONCEPT-MAP.md"],
  ["Learning path (study order)", "docs/LEARNING-PATH.md"],
  ["Service map (every AWS service → files → why)", "SERVICE-MAP.md"],
  ["Architecture decision records", "docs/adr"],
  ["Security", "docs/SECURITY.md"],
  ["Runbook", "docs/RUNBOOK.md"],
  ["Costs", "docs/COSTS.md"],
] as const;

const topics = [
  "AWS serverless fundamentals",
  "AWS Lambda",
  "Amazon API Gateway",
  "DynamoDB",
  "GraphQL",
  "AWS AppSync",
  "OpenSearch",
  "Event-driven serverless",
  "Security and observability",
  "Infrastructure and CI/CD",
  "Production system design",
  "Technical lead topics",
];

export default function LearnPage() {
  return (
    <section className="flex flex-col gap-6">
      <PageHeading>Learn how TicketLite works</PageHeading>
      <div>
        <h2 className="text-lg font-semibold">Documents</h2>
        <ul className="mt-2 list-disc pl-6">
          {docs.map(([label, path]) => (
            <li key={path}>
              <a href={`${REPO}/${path}`} className="text-indigo-700 underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-lg font-semibold">The 12 topics</h2>
        <ol className="mt-2 list-decimal pl-6">
          {topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ol>
        <p className="mt-2 text-slate-700">
          Each topic has its files, experiments and interview angles in the concept map.
        </p>
      </div>
    </section>
  );
}
