// Connector registry for /integrations. Numbered 1–100 continuously.
// WORKING = implemented in this repo and covered by tests/connectors.test.mjs.
// PLANNED = not built. VISION = not built, and would involve real money or chains.

export type ConnectorStatus = "WORKING" | "PLANNED" | "VISION";
export type ConnectorCategory = "A" | "B" | "C" | "D" | "E";

export interface Connector {
  id: number;
  name: string;
  category: ConnectorCategory;
  description: string;
  status: ConnectorStatus;
  implementation?: string;
  note?: string;
}

export const CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  "A": "Developer & Code",
  "B": "Databases & Warehouses",
  "C": "Collaboration & Workspaces",
  "D": "Payments & Crypto",
  "E": "Infra, Security & AI"
};

export const CONNECTORS: Connector[] = [
  {
    "id": 1,
    "name": "GitHub MCP Server",
    "category": "A",
    "description": "Repositories, issues, PRs, and actions.",
    "status": "WORKING",
    "implementation": "connector.github.read",
    "note": "Read-only: repo metadata, issues, pull requests. GITHUB_TOKEN optional, from env only."
  },
  {
    "id": 2,
    "name": "GitLab MCP Connector",
    "category": "A",
    "description": "Projects, merge requests, and pipelines.",
    "status": "PLANNED"
  },
  {
    "id": 3,
    "name": "Bitbucket Server",
    "category": "A",
    "description": "Enterprise repository state and webhooks.",
    "status": "PLANNED"
  },
  {
    "id": 4,
    "name": "GitHub Enterprise Server",
    "category": "A",
    "description": "On-premise source control synchronization.",
    "status": "PLANNED"
  },
  {
    "id": 5,
    "name": "Gitea / Forgejo Connector",
    "category": "A",
    "description": "Lightweight self-hosted code hosting integration.",
    "status": "PLANNED"
  },
  {
    "id": 6,
    "name": "Vercel Deployment Gateway",
    "category": "A",
    "description": "Preview environments and serverless runtime logs.",
    "status": "PLANNED"
  },
  {
    "id": 7,
    "name": "Netlify Edge Bridge",
    "category": "A",
    "description": "Static build telemetry and deployment hooks.",
    "status": "PLANNED"
  },
  {
    "id": 8,
    "name": "AWS CodePipeline Connector",
    "category": "A",
    "description": "CI/CD pipeline artifact tracking.",
    "status": "PLANNED"
  },
  {
    "id": 9,
    "name": "CircleCI API Gateway",
    "category": "A",
    "description": "Build failure diagnostics and test receipt ingestion.",
    "status": "PLANNED"
  },
  {
    "id": 10,
    "name": "Jenkins CI Bridge",
    "category": "A",
    "description": "Legacy build server job execution and status hooks.",
    "status": "PLANNED"
  },
  {
    "id": 11,
    "name": "Docker Hub / Registry API",
    "category": "A",
    "description": "Container image metadata and vulnerability inspection.",
    "status": "PLANNED"
  },
  {
    "id": 12,
    "name": "Kubernetes API Server (K8s MCP)",
    "category": "A",
    "description": "Cluster pod health, deployments, and logs.",
    "status": "PLANNED"
  },
  {
    "id": 13,
    "name": "Terraform Cloud Connector",
    "category": "A",
    "description": "Infrastructure-as-Code state inspection.",
    "status": "PLANNED"
  },
  {
    "id": 14,
    "name": "Sentry Error Tracking MCP",
    "category": "A",
    "description": "Real-time production exception logs and stack traces.",
    "status": "PLANNED"
  },
  {
    "id": 15,
    "name": "Datadog APM Bridge",
    "category": "A",
    "description": "Metrics, traces, and application performance alerts.",
    "status": "PLANNED"
  },
  {
    "id": 16,
    "name": "PostgreSQL MCP Connector",
    "category": "B",
    "description": "Schema discovery and scoped queries; snapshots require a separately configured database capability.",
    "status": "PLANNED",
    "note": "Postgres branch of connector.sql exists but is untested; not claimed as working."
  },
  {
    "id": 17,
    "name": "MySQL / MariaDB Gateway",
    "category": "B",
    "description": "Legacy relational database telemetry.",
    "status": "PLANNED"
  },
  {
    "id": 18,
    "name": "SQLite Local Driver",
    "category": "B",
    "description": "Lightweight embedded storage for agent scratchpads.",
    "status": "WORKING",
    "implementation": "connector.sql.query, connector.sql.schema, connector.sql.fingerprint",
    "note": "Read-only SELECT (row-capped) + schema reflection + SHA-256 fingerprint over the repo's Prisma SQLite datasource."
  },
  {
    "id": 19,
    "name": "MongoDB Atlas Connector",
    "category": "B",
    "description": "Document store schema profiling and aggregation streams.",
    "status": "PLANNED"
  },
  {
    "id": 20,
    "name": "Redis Data Structure Bridge",
    "category": "B",
    "description": "In-memory caching, pub/sub channels, and session RAM.",
    "status": "PLANNED"
  },
  {
    "id": 21,
    "name": "Snowflake Data Warehouse",
    "category": "B",
    "description": "Analytical query offloading and massive dataset processing.",
    "status": "PLANNED"
  },
  {
    "id": 22,
    "name": "Google BigQuery MCP",
    "category": "B",
    "description": "Enterprise data lake and analytics integration.",
    "status": "PLANNED"
  },
  {
    "id": 23,
    "name": "Amazon Redshift Connector",
    "category": "B",
    "description": "Columnar database analytics bridge.",
    "status": "PLANNED"
  },
  {
    "id": 24,
    "name": "Supabase Realtime Bridge",
    "category": "B",
    "description": "PostgreSQL backend sync with real-time event hooks.",
    "status": "PLANNED"
  },
  {
    "id": 25,
    "name": "PlanetScale Serverless Connector",
    "category": "B",
    "description": "Branching relational database management.",
    "status": "PLANNED"
  },
  {
    "id": 26,
    "name": "Neo4j Graph Database",
    "category": "B",
    "description": "Relationship mapping for temporal knowledge graphs.",
    "status": "PLANNED"
  },
  {
    "id": 27,
    "name": "Pinecone Vector Database",
    "category": "B",
    "description": "Semantic similarity index and embedding lookups.",
    "status": "PLANNED"
  },
  {
    "id": 28,
    "name": "Qdrant Vector Engine",
    "category": "B",
    "description": "High-performance vector memory connector.",
    "status": "PLANNED"
  },
  {
    "id": 29,
    "name": "Chroma DB Bridge",
    "category": "B",
    "description": "Local embedding workspace storage.",
    "status": "PLANNED"
  },
  {
    "id": 30,
    "name": "Elasticsearch / OpenSearch",
    "category": "B",
    "description": "Full-text search and log analytics bridge.",
    "status": "PLANNED"
  },
  {
    "id": 31,
    "name": "Google Drive MCP Server",
    "category": "C",
    "description": "File search, document reading, and media ingestion.",
    "status": "PLANNED"
  },
  {
    "id": 32,
    "name": "Microsoft OneDrive / SharePoint",
    "category": "C",
    "description": "Enterprise document repository sync.",
    "status": "PLANNED"
  },
  {
    "id": 33,
    "name": "Dropbox Enterprise API",
    "category": "C",
    "description": "Cloud storage artifact retrieval.",
    "status": "PLANNED"
  },
  {
    "id": 34,
    "name": "Notion Workspace MCP",
    "category": "C",
    "description": "Page search, wiki reading, and knowledge base sync.",
    "status": "PLANNED"
  },
  {
    "id": 35,
    "name": "Slack MCP Integration",
    "category": "C",
    "description": "Channel messaging, thread inspection, and canvas sync.",
    "status": "PLANNED"
  },
  {
    "id": 36,
    "name": "Microsoft Teams Gateway",
    "category": "C",
    "description": "Enterprise chat and meeting telemetry.",
    "status": "PLANNED"
  },
  {
    "id": 37,
    "name": "Discord Bot / Webhook Gateway",
    "category": "C",
    "description": "Community event tracking and real-time alerts.",
    "status": "PLANNED"
  },
  {
    "id": 38,
    "name": "Linear Issue Tracker",
    "category": "C",
    "description": "Engineering sprint cycle and issue management.",
    "status": "PLANNED"
  },
  {
    "id": 39,
    "name": "Jira Atlassian Rovo MCP",
    "category": "C",
    "description": "Epic, bug, and project tracking.",
    "status": "PLANNED"
  },
  {
    "id": 40,
    "name": "Confluence Knowledge Base",
    "category": "C",
    "description": "Technical documentation and internal spec ingestion.",
    "status": "PLANNED"
  },
  {
    "id": 41,
    "name": "Asana Project Management",
    "category": "C",
    "description": "Task dependency and milestone tracking.",
    "status": "PLANNED"
  },
  {
    "id": 42,
    "name": "Monday.com Work OS Bridge",
    "category": "C",
    "description": "Multi-project portfolio status boards.",
    "status": "PLANNED"
  },
  {
    "id": 43,
    "name": "ClickUp Task Manager",
    "category": "C",
    "description": "Custom task state and document syncing.",
    "status": "PLANNED"
  },
  {
    "id": 44,
    "name": "Notion Calendar / Google Calendar",
    "category": "C",
    "description": "Temporal event scheduling and deadlines.",
    "status": "PLANNED"
  },
  {
    "id": 45,
    "name": "Gmail / Microsoft Outlook MCP",
    "category": "C",
    "description": "Secure email parsing and notification triggers.",
    "status": "PLANNED"
  },
  {
    "id": 46,
    "name": "Intercom Customer Support",
    "category": "C",
    "description": "Live customer chat thread ingestion.",
    "status": "PLANNED"
  },
  {
    "id": 47,
    "name": "Zendesk Support Ticketing",
    "category": "C",
    "description": "Customer issue state and resolution tracking.",
    "status": "PLANNED"
  },
  {
    "id": 48,
    "name": "HubSpot CRM Connector",
    "category": "C",
    "description": "Customer profile and deal stage mapping.",
    "status": "PLANNED"
  },
  {
    "id": 49,
    "name": "Salesforce CRM Bridge",
    "category": "C",
    "description": "Enterprise account data synchronization.",
    "status": "PLANNED"
  },
  {
    "id": 50,
    "name": "Notion Database Connector",
    "category": "C",
    "description": "Structured tabular record access.",
    "status": "PLANNED"
  },
  {
    "id": 51,
    "name": "Airtable Base Gateway",
    "category": "C",
    "description": "Relational sheet synchronization.",
    "status": "PLANNED"
  },
  {
    "id": 52,
    "name": "Coda Doc Connector",
    "category": "C",
    "description": "Interactive document and table integration.",
    "status": "PLANNED"
  },
  {
    "id": 53,
    "name": "Figma Design System MCP",
    "category": "C",
    "description": "Design frames, component structures, and Code Connect mappings.",
    "status": "PLANNED"
  },
  {
    "id": 54,
    "name": "Canva Design Platform",
    "category": "C",
    "description": "Asset export and visual generation.",
    "status": "PLANNED"
  },
  {
    "id": 55,
    "name": "Blender 3D Geometry Connector",
    "category": "C",
    "description": "Spatial scene analysis and mesh optimization.",
    "status": "PLANNED"
  },
  {
    "id": 56,
    "name": "Stripe Billing & Payments API",
    "category": "D",
    "description": "Subscription event and invoice tracking.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 57,
    "name": "PayPal Commerce Bridge",
    "category": "D",
    "description": "Payout status and transaction events; payment writes require explicit authorization and review.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 58,
    "name": "Etherscan EVM Blockchain MCP",
    "category": "D",
    "description": "Smart-contract, gas-fee, and wallet lookups across supported EVM networks.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 59,
    "name": "Solana Web3 RPC Gateway",
    "category": "D",
    "description": "On-chain program interaction and transaction state.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 60,
    "name": "Polygon L2 Bridge",
    "category": "D",
    "description": "Low-cost settlement data streams.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 61,
    "name": "Circle USDC Treasury Connector",
    "category": "D",
    "description": "USDC activity and balance lookups; minting and burning require issuer authorization.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 62,
    "name": "Coinbase Commerce API",
    "category": "D",
    "description": "Crypto payment gateway integration.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 63,
    "name": "Uniswap V3 Liquidity Bridge",
    "category": "D",
    "description": "Read-only pool monitoring; swaps require a separately authorized transaction signer.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 64,
    "name": "Gnosis Safe Multi-Sig Gateway",
    "category": "D",
    "description": "Multi-signature treasury governance votes.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 65,
    "name": "DeFiLlama Yield API",
    "category": "D",
    "description": "Protocol TVL and interest rate intelligence.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 66,
    "name": "Teller Banking API",
    "category": "D",
    "description": "Corporate fiat account balance checks.",
    "status": "VISION",
    "note": "Listed as 'Plank / Teller' in the source; Plank could not be identified as a banking API, so this entry is Teller only. Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 67,
    "name": "Wise Cross-Border Payments",
    "category": "D",
    "description": "International multi-currency payout management.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 68,
    "name": "QuickBooks Accounting Bridge",
    "category": "D",
    "description": "Financial ledger and expense categorization.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 69,
    "name": "Xero Financial Connector",
    "category": "D",
    "description": "Automated balance sheet reconciliation.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 70,
    "name": "Plaid Banking Data Bridge",
    "category": "D",
    "description": "Secure financial institution data ingestion.",
    "status": "VISION",
    "note": "Real-money or on-chain actions would require operator approval and are disabled by default. Nothing is connected."
  },
  {
    "id": 71,
    "name": "Cloudflare Workers & KV MCP",
    "category": "E",
    "description": "Worker deployment metadata and scoped KV operations; changes require explicit authorization.",
    "status": "PLANNED"
  },
  {
    "id": 72,
    "name": "Vercel AI SDK Gateway",
    "category": "E",
    "description": "Unified model provider invocation proxy.",
    "status": "PLANNED"
  },
  {
    "id": 73,
    "name": "OpenAI API Gateway",
    "category": "E",
    "description": "GPT model fallback routing.",
    "status": "PLANNED"
  },
  {
    "id": 74,
    "name": "Anthropic Claude API Gateway",
    "category": "E",
    "description": "Claude model integration.",
    "status": "PLANNED"
  },
  {
    "id": 75,
    "name": "Google Vertex AI Connector",
    "category": "E",
    "description": "Enterprise Gemini cloud execution.",
    "status": "PLANNED"
  },
  {
    "id": 76,
    "name": "DeepSeek API Gateway",
    "category": "E",
    "description": "High-performance reasoning model bridge.",
    "status": "PLANNED"
  },
  {
    "id": 77,
    "name": "Groq LPU Inference Bridge",
    "category": "E",
    "description": "Ultra-fast open-weight model serving.",
    "status": "PLANNED"
  },
  {
    "id": 78,
    "name": "Ollama Local Model Connector",
    "category": "E",
    "description": "Zero-egress local hardware execution.",
    "status": "PLANNED"
  },
  {
    "id": 79,
    "name": "vLLM Distributed Serving Gateway",
    "category": "E",
    "description": "High-throughput open model hosting.",
    "status": "PLANNED"
  },
  {
    "id": 80,
    "name": "Hugging Face Hub API",
    "category": "E",
    "description": "Model weight and dataset retrieval.",
    "status": "PLANNED"
  },
  {
    "id": 81,
    "name": "Pinecone Serverless Index",
    "category": "E",
    "description": "Dynamic vector partition management.",
    "status": "PLANNED"
  },
  {
    "id": 82,
    "name": "Upstash Redis & Qstash Bridge",
    "category": "E",
    "description": "Serverless message queues and cron triggers.",
    "status": "PLANNED"
  },
  {
    "id": 83,
    "name": "Auth0 / Okta Identity Provider",
    "category": "E",
    "description": "OAuth token exchange and user claims verification.",
    "status": "PLANNED"
  },
  {
    "id": 84,
    "name": "Keycloak IAM Gateway",
    "category": "E",
    "description": "Open-source identity and access management sync.",
    "status": "PLANNED"
  },
  {
    "id": 85,
    "name": "Cloudflare Zero Trust Tunnel",
    "category": "E",
    "description": "Secure private network ingress for internal tools.",
    "status": "PLANNED"
  },
  {
    "id": 86,
    "name": "HashiCorp Vault Connector",
    "category": "E",
    "description": "Dynamic secret injection and encryption key rotation.",
    "status": "PLANNED"
  },
  {
    "id": 87,
    "name": "Postman / OpenAPI Test Runner",
    "category": "E",
    "description": "API endpoint schema validation.",
    "status": "PLANNED",
    "note": "The OpenAPI → MCP tool reflector (bridge #8) is built; running API tests is not."
  },
  {
    "id": 88,
    "name": "Playwright Web Automation MCP",
    "category": "E",
    "description": "End-to-end browser testing, form filling, and DOM inspection.",
    "status": "PLANNED"
  },
  {
    "id": 89,
    "name": "Cypress Test Dashboard",
    "category": "E",
    "description": "Automated test suite result ingestion.",
    "status": "PLANNED"
  },
  {
    "id": 90,
    "name": "Grafana Dashboards API",
    "category": "E",
    "description": "Metric visualization and alerting state.",
    "status": "PLANNED"
  },
  {
    "id": 91,
    "name": "Prometheus Time-Series Scraper",
    "category": "E",
    "description": "Infrastructure CPU/memory telemetry.",
    "status": "PLANNED"
  },
  {
    "id": 92,
    "name": "New Relic APM Bridge",
    "category": "E",
    "description": "Distributed tracing and error logging.",
    "status": "PLANNED"
  },
  {
    "id": 93,
    "name": "PagerDuty Incident Gateway",
    "category": "E",
    "description": "Critical alert dispatch and escalation tracking.",
    "status": "PLANNED"
  },
  {
    "id": 94,
    "name": "Twilio SMS & Voice Gateway",
    "category": "E",
    "description": "Telephony notification dispatch.",
    "status": "PLANNED"
  },
  {
    "id": 95,
    "name": "SendGrid Email Dispatcher",
    "category": "E",
    "description": "Programmatic transactional email delivery.",
    "status": "PLANNED"
  },
  {
    "id": 96,
    "name": "Postmark Transactional Mail",
    "category": "E",
    "description": "High-deliverability email logging.",
    "status": "PLANNED"
  },
  {
    "id": 97,
    "name": "Linear Webhook Relay",
    "category": "E",
    "description": "Real-time engineering ticket synchronization.",
    "status": "PLANNED"
  },
  {
    "id": 98,
    "name": "GitHub Actions Webhook Bridge",
    "category": "E",
    "description": "CI completion state notification.",
    "status": "WORKING",
    "implementation": "POST /api/integrations/webhook",
    "note": "HMAC-verified GitHub webhooks (incl. workflow_run) mapped to observe-only intent records."
  },
  {
    "id": 99,
    "name": "S3-Compatible Object Storage (MinIO/R2)",
    "category": "E",
    "description": "Unstructured binary blob and dataset storage.",
    "status": "PLANNED"
  },
  {
    "id": 100,
    "name": "HELLO OS Native Substrate Bus",
    "category": "E",
    "description": "Inter-pillar state synchronization (hello://).",
    "status": "PLANNED",
    "note": "hello:// URIs exist inside the local MCP service; a cross-pillar bus is not built."
  }
];
