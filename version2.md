SRP SMARTRECRUIT V2 MASTER ENGINEERING, AI, RAG, SECURITY & SYSTEM ENHANCEMENT INSTRUCTION

CRITICAL — VERSION IDENTITY

"V2" in this file is a REQUIREMENTS / ENGINEERING BASELINE only.
It is NOT the application release version and NOT the codebase to reset to.

Current application version = nextjs-auth/package.json (semver; see docs/VERSIONING.md).
Database level = db/migrate_vN.sql (independent; e.g. migrate_v41 ≠ App V41).
Next implementation target = next semver after the current package version (e.g. 1.4.0 after 1.3.0).

Compare V2 requirements against the LATEST app version. Preserve and enhance that app.
Never rebuild V2. Never treat V2 as the implementation baseline.

Gap matrix: docs/master/V2-Applicability-Matrix.md

0. MISSION

We are enhancing the existing SRP SmartRecruit / Recruitment OS application.

This is V2 **requirements-driven** development against the current application semver.

The objective is to enhance the existing system into a professional, secure, scalable recruitment operating platform with:

Recruitment management
Candidate management
Job management
Client management
Submissions
Interviews
Follow-ups
Offer & onboarding
Documents
Recruiter performance
Communications
Email
WhatsApp
LinkedIn
SMS
Telegram
AI capabilities
RAG
Agentic AI
Workflow / graph orchestration
Analytics
Power BI readiness
Strong security
Proper database engineering
Proper integration architecture
Proper observability
Production-grade engineering

IMPORTANT: This is NOT a rewrite.

The current application (package.json semver) contains working functionality and is the CODE BASELINE.

That baseline must remain protected (historically called “V1” in older text — interpret as “current stable product,” not app version 1.0 only).

1. TWO DOCUMENTS ARE MANDATORY

Before touching the code, completely read:

DOCUMENT 1 — Universal Master Engineering Standard (HOW)

Path: docs/UNIVERSAL_MASTER_ENGINEERING_STANDARD.md
Related baseline: docs/TRUST_SECURITY_GRC.md

DOCUMENT 2 — Project-Specific Document (WHAT)

Path: docs/master/ (start at docs/master/README.md + docs/master/CONSISTENCY.md)

Living gap tracker (Applicability Matrix §7): docs/master/V2-Applicability-Matrix.md

These documents must be treated differently.

Project Document = WHAT

The Project-Specific Document defines:

Product requirements
Features
Users
Business rules
Workflows
Existing architecture
Functional requirements
Constraints
Integrations
Product objectives
Master Engineering Standard = HOW

The Universal Master Engineering Standard defines:

Engineering quality
Architecture
Security
Database engineering
DBA
AI engineering
RAG
Agentic AI
Graph/workflow engineering
DevOps
DevSecOps
SRE
QA
Compliance
Reliability
Production readiness

Do NOT blindly combine the documents.

Navigation taxonomy SoT: docs/master/01-core/05-Navigation.md (not invent a second IA).
version2 §10 only requires preserving V1 visual patterns and applying collapse/expand to major groups.

Use:

PROJECT REQUIREMENTS
        ↓
WHAT DOES SRP SMARTRECRUIT NEED?
        ↓
MASTER ENGINEERING STANDARD
        ↓
HOW SHOULD IT BE ENGINEERED?
        ↓
APPLICABILITY
        ↓
ARCHITECTURE
        ↓
IMPLEMENTATION
        ↓
TESTING
        ↓
SECURITY VALIDATION
        ↓
PRODUCTION READINESS
2. ABSOLUTE RULE — DO NOT MODIFY V1 FIRST

The existing V1 is protected.

DO NOT:

Delete V1
Replace V1
Rewrite V1
Remove existing features
Remove existing APIs
Remove existing integrations
Remove existing database functionality
Replace stable libraries without justification
Replace the existing frontend unnecessarily
Replace the existing backend unnecessarily
Change working workflows unnecessarily
Destroy existing configuration
Destroy existing data
Change existing UI patterns without justification

If an existing implementation is working:

PRESERVE IT.

V2 should extend or safely evolve it.

3. VERSION STRATEGY

Maintain:

V1
└── Stable / Existing Production

V2
├── Development
├── Testing
├── Staging
└── Production

V1 must remain recoverable.

Use:

Git
Branching
Tags/releases
Migration versioning
Deployment versioning
Rollback strategy

If V2 fails:

V2
 ↓
Rollback
 ↓
Previous V2 release
OR
V1 Stable

Never make V1 unrecoverable.

4. DATABASE ROLLBACK RULE

Application rollback is NOT the same as database rollback.

For every database change evaluate:

Current Schema
      ↓
V2 Schema
      ↓
Migration
      ↓
Compatibility
      ↓
Deployment
      ↓
Rollback / Recovery

Never perform destructive database changes without a documented migration and recovery strategy.

5. BEFORE CODING — MANDATORY AUDIT

DO NOT CODE YET.

First inspect the entire repository.

Understand:

Frontend
Framework
Components
Pages
Routes
State
Forms
UI library
Styling
Navigation
API clients
Backend
Framework
Services
Controllers
APIs
Authentication
Authorization
Business logic
Background jobs
Workflows
Database
Database technology
Tables
Relationships
Indexes
Constraints
Migrations
Queries
Data model
Infrastructure
Cloud
Deployment
Environment variables
Secrets
Networking
CI/CD
Storage
Integrations
Email
WhatsApp
LinkedIn
SMS
Telegram
Other APIs
AI
Existing AI
Models
Prompts
AI services
RAG
Embeddings
Vector storage
Agents
Tools
Workflows
6. REQUIRED PRE-CODING REPORT

Before modifying code, provide:

A. Current Architecture
Frontend
   ↓
API / Backend
   ↓
Business Logic
   ↓
Database
   ↓
External Integrations

Use the actual architecture found in the repository.

Do not invent anything.

B. Current Module Map

Map every existing module.

For example:

RECRUITMENT
├── Dashboard
├── Jobs
├── Candidates
├── Clients
├── Internal Talent Pool
├── Submissions
├── Interviews
├── Follow-ups
├── Offer & Onboarding
├── Documents
└── My Performance

AI TOOLS
├── AI Features
├── RAG
├── Agents
├── Workflows
└── Other AI capabilities

OPERATIONS
├── Communications
├── ESS
└── Settings

Use the actual repository.

7. APPLICABILITY MATRIX

Evaluate EVERY engineering discipline below.

For each item provide:

AREA
CURRENT STATE
APPLICABLE?
REQUIRED?
CURRENT GAP
RISK
RECOMMENDATION
IMPLEMENTATION
STATUS

Allowed status:

REQUIRED
RECOMMENDED
NOT REQUIRED
FUTURE
ALREADY IMPLEMENTED

Do not implement something just because it appears in this list.

8. SOFTWARE ARCHITECTURE

Evaluate:

Overall architecture
Modular architecture
Frontend architecture
Backend architecture
API architecture
Service boundaries
Dependency management
Separation of concerns
SOLID principles
Design patterns
Coupling
Cohesion
Extensibility
Maintainability
Scalability
Reliability
Versioning
Backward compatibility
Technical debt

Prefer the existing architecture unless there is a demonstrated reason to change it.

9. FRONTEND ENGINEERING

Evaluate:

Existing framework
Component architecture
Routing
State management
API integration
Forms
Validation
Error states
Loading states
Empty states
Accessibility
Responsive design
Mobile
Desktop
Browser compatibility
Performance
Security
XSS
CSRF where applicable
Token handling
UI consistency

Do not introduce another frontend framework unnecessarily.

10. NAVIGATION V2

Authoritative group taxonomy and AI Hub TARGET: docs/master/01-core/05-Navigation.md + docs/master/CONSISTENCY.md.

The existing navigation visual pattern must be preserved.

The current AI Tools section has collapse/expand behavior.

Apply the same collapse/expand pattern to other major navigation groups (Recruitment, AI, Operations).

AI TARGET: one AI Hub sidebar entry; tool shortcuts may live inside the collapsed AI group as deep links (do not permanently re-expand five AI roots as peer top-level items).

Requirements:

Preserve existing design
Preserve existing icons
Preserve existing typography
Preserve existing colors
Preserve routes (tab keys / bookmarks may alias into AI Hub)
Preserve active states
Desktop support
Mobile support
Keyboard accessibility where applicable
No duplicate navigation logic
No unnecessary redesign

Reuse the existing collapse implementation.

11. BACKEND ENGINEERING

Evaluate:

APIs
Controllers
Services
Business logic
Validation
Authentication
Authorization
Transactions
Idempotency
Concurrency
Rate limiting
Error handling
API versioning
Logging
Monitoring
Performance
12. DATABASE ENGINEERING

Treat the database as a professional Database Engineering / DBA responsibility.

Evaluate:

Schema
Tables
Relationships
Primary keys
Foreign keys
Constraints
Indexes
Unique constraints
Normalization
Denormalization
Query patterns
Query plans
Slow queries
N+1 queries
Pagination
Transactions
Isolation
Locks
Deadlocks
Connection pooling
Data integrity
Referential integrity
Soft deletion
Audit fields
Data retention
Archiving
Migration
Rollback
Backup
Restore
Disaster recovery
Replication where applicable
Database security
Encryption
Privileges

Never casually change existing tables.

13. DBA

Evaluate separately:

Database availability
Backup
Restore
Restore testing
RPO
RTO
Capacity
Storage
Connection limits
Database users
Database permissions
Monitoring
Maintenance
Replication
Failover
Disaster recovery
14. DATA ENGINEERING

Evaluate:

Operational data
Data pipelines
ETL
ELT
Transformation
Data validation
Data quality
Data lineage
Data ownership
Data retention
Historical data
Analytics data
Reporting data
Incremental processing
Failure recovery
15. DATA SCIENCE / ML

Determine whether ML is required.

If applicable evaluate:

Candidate ranking
Candidate matching
Job matching
Classification
Prediction
Feature engineering
Training data
Evaluation
Bias
Explainability
Model monitoring
Model drift
Model versioning
Privacy

Do not introduce ML if AI/ML does not provide a justified benefit.

16. AI ENGINEERING

AI is an important part of V2.

Evaluate:

LLM architecture
Model provider
Model selection
Model routing
Prompt architecture
System prompts
User prompts
Structured output
Function/tool calling
Context management
Token limits
Cost
Latency
Reliability
Hallucination
Evaluation
Guardrails
Model versioning
Fallback
AI monitoring
17. RAG — REQUIRED V2 CAPABILITY

RAG must be properly architected.

Do NOT create a superficial chatbot and call it RAG.

Evaluate the complete RAG lifecycle:

Documents / Knowledge
        ↓
Ingestion
        ↓
Validation
        ↓
Parsing
        ↓
Cleaning
        ↓
Chunking
        ↓
Metadata
        ↓
Embeddings
        ↓
Vector Store
        ↓
Retrieval
        ↓
Filtering
        ↓
Ranking
        ↓
Context Construction
        ↓
LLM
        ↓
Answer
        ↓
Citation / Provenance
        ↓
Evaluation

RAG must support appropriate:

Document ingestion
PDF
DOC/DOCX
TXT
Structured data where applicable
Metadata
Document version
Source
Owner
Tenant
Permissions
Created date
Updated date
Document status
Chunking
Embeddings
Vector storage
Retrieval
Hybrid retrieval if justified
Reranking if justified
Context limits
Citation
Provenance
Re-indexing
Deletion
Versioning
Access control
18. RAG SECURITY

Evaluate:

Prompt injection
Indirect prompt injection
RAG poisoning
Malicious documents
Cross-tenant retrieval
Unauthorized documents
Data leakage
Permission leakage
Sensitive information exposure
Retrieval filtering
Document access control
Metadata poisoning
Embedding abuse
Index corruption
Deletion consistency

Critical rule:

USER
 ↓
AUTHORIZATION
 ↓
TENANT FILTER
 ↓
DOCUMENT PERMISSION FILTER
 ↓
RETRIEVAL

Never retrieve documents first and attempt security filtering afterward.

19. RAG EVALUATION

Evaluate:

Retrieval accuracy
Recall
Precision
Relevance
Groundedness
Citation correctness
Hallucination
Context quality
Latency
Cost

Create evaluation datasets where appropriate.

Do not claim RAG quality without testing.

20. AGENTIC AI

Agentic AI is part of the V2 architecture where justified.

Evaluate:

Agent identity
Agent purpose
Agent state
Agent memory
Agent tools
Tool permissions
Tool allowlist
Planning
Execution
Verification
Retry
Timeout
Failure recovery
Human approval
Human-in-the-loop
Cost limits
Token limits
Maximum iterations
Maximum tool calls
Audit
Observability

Agents must operate under least privilege.

21. AGENT LOOPS

Every agent loop must have explicit boundaries.

Use:

INPUT
 ↓
PLAN
 ↓
EXECUTE
 ↓
OBSERVE
 ↓
VALIDATE
 ↓
DECIDE
 ↓
CONTINUE
OR
STOP

Mandatory:

Maximum iterations
Timeout
Maximum tool calls
Maximum token/cost budget
Error handling
Exit condition
Human escalation
Destructive-action protection

Prevent:

Infinite loops
Recursive execution
Runaway cost
Repeated actions
Duplicate actions
Destructive loops
22. GRAPH / WORKFLOW ENGINEERING

Where workflows are used, model them as explicit stateful workflows/graphs.

Evaluate:

Nodes
Edges
Conditions
Branches
Loops
State
State persistence
Retry
Timeout
Error states
Compensation
Idempotency
Human approval
Resume
Execution history
Versioning
Rollback

Example:

TRIGGER
 ↓
VALIDATE
 ↓
PROCESS
 ↓
DECISION
 ├── SUCCESS
 ├── RETRY
 ├── HUMAN APPROVAL
 └── FAILURE
23. LANGGRAPH / GRAPH ORCHESTRATION

If LangGraph or an equivalent graph orchestration framework is appropriate, evaluate:

Stateful graph execution
Nodes
Edges
Conditional routing
Loops
Checkpoints
State persistence
Interrupts
Human approval
Resume
Retry
Failure recovery
Agent/tool boundaries
Graph versioning
Observability

Do not introduce LangGraph merely because it is popular.

If another existing architecture is better, document why.

24. MULTI-AGENT SYSTEMS

If multiple agents are used, define:

ORCHESTRATOR
     ↓
 ┌───┼────────┐
 ↓   ↓        ↓
Agent Agent   Agent

Evaluate:

Agent roles
Agent responsibilities
Agent permissions
Communication
Shared state
Message passing
Coordination
Conflict handling
Deadlocks
Loops
Timeouts
Cost
Audit
Human escalation

Never allow unrestricted agents to call arbitrary tools.

25. AI TOOL SECURITY

Every AI tool must define:

Tool
Purpose
Allowed Agent
Allowed User Role
Allowed Tenant
Input Schema
Output Schema
Permission
Rate Limit
Timeout
Audit

Examples:

send_email
delete_email
archive_email
create_calendar_event
send_whatsapp
send_sms
update_candidate
create_job
modify_candidate

High-risk actions require appropriate confirmation or authorization.

26. COMMUNICATIONS V2

The existing Communications module must be enhanced without destroying the existing functionality.

Current areas include:

Email Inbox
WhatsApp Inbox
LinkedIn
SMS
Send
Templates
Providers

Maintain this overall structure.

Improve the provider architecture.

27. EMAIL PROVIDER ARCHITECTURE

Email must support different provider types.

EMAIL
├── Gmail / Google Workspace
├── Microsoft 365 / Outlook
├── Company Email
├── Custom SMTP
└── Other supported provider

Each provider must have its own correct authentication/configuration model.

28. GMAIL / GOOGLE WORKSPACE

Where applicable support:

OAuth
Google account
Client ID
Client Secret
Redirect URI
Scopes
Connected email
Connection status
Token lifecycle

Do not expose secrets in frontend code.

29. MICROSOFT 365 / OUTLOOK

Where applicable support:

Microsoft OAuth
Tenant ID
Client ID
Client Secret
Redirect URI
Scopes
Connected account
Token lifecycle
Connection status

Do not force SMTP username/password where a proper OAuth/API architecture is required.

30. COMPANY EMAIL / SMTP

Support appropriate:

SMTP host
Port
Encryption
TLS
SSL
STARTTLS where applicable
Username
Password/secret
From name
From email
Reply-to
Connection test
Status

Secrets must be protected.

31. WHATSAPP BUSINESS

WhatsApp requires a dedicated Meta integration.

Map correctly:

Meta
 ↓
Meta Developer App
 ↓
Meta Business
 ↓
WhatsApp Business Account
 ↓
Phone Number
 ↓
Phone Number ID
 ↓
WhatsApp API
 ↓
Webhook
 ↓
SRP SmartRecruit

Evaluate/configure appropriate:

Meta App ID
App Secret
Business ID
WhatsApp Business Account ID
Phone Number ID
Access Token
API version
Webhook URL
Verify token
Permissions
Message templates
Delivery status
Read status
Failed messages
Inbound messages
Outbound messages

Do not create fake Meta configuration.

32. LINKEDIN

Map:

LinkedIn
 ↓
Developer Application
 ↓
OAuth
 ↓
Client ID
 ↓
Client Secret
 ↓
Redirect URI
 ↓
Scopes
 ↓
Connected Account
 ↓
Token lifecycle

Only implement capabilities supported by the actual approved LinkedIn API access.

Do not invent unsupported LinkedIn APIs.

33. SMS

Create provider-aware architecture:

SMS
 ↓
Provider
 ↓
Account
 ↓
Sender ID / Number
 ↓
Credentials
 ↓
API
 ↓
Webhook
 ↓
Delivery status
34. TELEGRAM

Map:

Telegram
 ↓
Bot
 ↓
Bot Token
 ↓
Webhook
 ↓
Chat/User Mapping
 ↓
Connection Status

Protect bot tokens.

35. PROVIDER MANAGEMENT

Every provider should have:

Provider
Account
Status
Connected Date
Last Tested
Default
Enabled

Actions:

Connect
Test
Edit
Set Default
Disable
Disconnect
Delete

Deletion requires confirmation.

36. CONNECTION TESTING

Every integration must support actual connection validation.

Configure
 ↓
Save Securely
 ↓
Test
 ↓
Authenticate
 ↓
Validate Permissions
 ↓
Validate API
 ↓
Return Status

Possible statuses:

Not Configured
Configuration Required
Connecting
Connected
Connection Failed
Expired
Disabled

Do not say "Connected" unless it has actually been validated.

37. SECRETS MANAGEMENT

Never expose:

Passwords
API keys
OAuth secrets
Access tokens
Refresh tokens
Webhook secrets

in:

Git
Frontend bundles
localStorage
URLs
Logs
Error messages
Public configuration

Use the existing secure mechanism where available.

38. IAM / RBAC

Evaluate:

Users
Roles
Permissions
Resource permissions
Integration permissions
Admin permissions
AI permissions
Agent permissions
Least privilege
Privilege escalation
Service identities
API permissions

Only authorized users should configure communication providers.

39. MULTI-TENANT SECURITY

If multi-tenancy exists, enforce tenant isolation at every layer.

Tenant
 ↓
User
 ↓
Jobs
 ↓
Candidates
 ↓
Clients
 ↓
Documents
 ↓
Communications
 ↓
Providers
 ↓
AI
 ↓
RAG
 ↓
Agents
 ↓
Analytics
 ↓
Power BI

Tenant A must never access Tenant B data.

Do not rely on frontend filtering.

40. FILE SECURITY

Because recruitment systems handle CVs and documents, evaluate:

File validation
MIME validation
File size
Extension validation
Malware scanning
Storage isolation
Access control
Signed URLs
Download authorization
Filename sanitization
Path traversal
Retention
Deletion
41. CYBERSECURITY

Evaluate:

Application security
API security
Database security
Network security
Cloud security
Authentication
Authorization
Encryption
Secrets
Sessions
Input validation
Output encoding
File security
Dependency security
Supply chain
Logging
Auditing
Incident response
42. OWASP

Evaluate relevant:

OWASP Top 10
OWASP API Security
Broken access control
Injection
Authentication failures
Cryptographic failures
Security misconfiguration
Vulnerable components
Logging failures
SSRF where applicable
43. NIST

Evaluate relevant NIST practices including:

Identify
Protect
Detect
Respond
Recover

For AI:

AI risk
AI governance
AI evaluation
AI security
AI safety
AI monitoring
44. GRC / GOVERNANCE

Evaluate:

Policies
Access control
Audit
Data handling
Risk
Security controls
Evidence
Retention
Incident management
Compliance requirements

Never claim certification or compliance without evidence.

45. DEVSECOPS

Evaluate:

Git
Branching
Pull requests
Code review
Secret scanning
Dependency scanning
SAST
DAST where appropriate
Container scanning where applicable
CI/CD
Environment separation
Security gates
Release approval
46. CLOUD

Evaluate only the cloud technologies actually used.

Review:

IAM
Compute
Storage
Network
Secrets
Encryption
Logging
Monitoring
Backup
Recovery
Availability
Cost

Do not introduce cloud infrastructure unnecessarily.

47. NETWORKING

Evaluate:

HTTPS
TLS
Firewall
Ingress
Egress
DNS
Ports
Webhooks
API exposure
Network boundaries
Rate limits
48. DEVOPS

Evaluate:

Development
 ↓
Testing
 ↓
Staging
 ↓
Production

Include:

CI/CD
Configuration
Secrets
Deployment
Release
Rollback
Environment separation
49. SRE / RELIABILITY

Evaluate:

Availability
Reliability
Timeouts
Retry
Idempotency
Circuit breaker where justified
Graceful degradation
Capacity
Failure recovery
SLO where appropriate
Error budgets where appropriate
50. QA / TEST ENGINEERING

Test:

Unit
Business logic
Services
Components
Integration
APIs
Database
Providers
Webhooks
E2E
Recruitment workflows
Communication workflows
AI workflows
Security
Authentication
Authorization
Tenant isolation
Secrets
API security
File security
RAG security
Agent security
Regression

All important V1 functionality must continue working.

51. PERFORMANCE ENGINEERING

Evaluate:

Frontend performance
API latency
Database queries
Indexes
N+1
Pagination
Caching
Background jobs
Concurrent users
Provider latency
AI latency
RAG latency
Vector retrieval
Agent execution
Cost

Measure before optimizing.

52. OBSERVABILITY

Evaluate:

Logs
Metrics
Errors
Traces where justified
API failures
Database performance
Webhook failures
Provider failures
AI failures
RAG retrieval
Agent execution
Workflow execution

Never log secrets.

Minimize logging of sensitive candidate information.

53. ANALYTICS ARCHITECTURE

Once operational data is properly mapped, create the analytics architecture.

Application
 ↓
Operational Database
 ↓
Data Mapping
 ↓
Analytics Model
 ↓
Reporting Layer
 ↓
Power BI

Map:

Jobs
Candidates
Clients
Submissions
Interviews
Follow-ups
Offers
Onboarding
Communications
Emails
WhatsApp
LinkedIn
SMS
Telegram
Recruiters
AI usage
RAG usage
Agent usage
54. POWER BI DATA MODEL

Before connecting Power BI, define:

Facts

Examples where applicable:

Applications
Submissions
Interviews
Communications
Messages
Offers
Dimensions

Examples:

Candidate
Recruiter
Client
Job
Location
Date
Communication channel

Use the actual application schema as the source.

Do not invent database fields.

55. ANALYTICS SECURITY

Power BI/reporting must respect:

Tenant isolation
RBAC
PII
Candidate confidentiality
Data access
Reporting permissions
Data retention

Never expose candidate information simply because the reporting system can technically access it.

56. PRIVACY

Evaluate recruitment-related personal information:

Candidate information
CVs
Email
Phone
Identity data
Documents
Communication history
Client information

Evaluate:

Data minimization
Retention
Deletion
Access
Export
Audit
Privacy controls
57. BACKUP / DISASTER RECOVERY

Evaluate:

Database backup
Application backup
Document backup
Configuration
Secrets recovery
Restore
Restore testing
RPO
RTO
Disaster scenarios
Rollback
58. DOCUMENTATION

Document:

Architecture
Database
APIs
Integrations
Email configuration
WhatsApp configuration
LinkedIn configuration
SMS configuration
Telegram configuration
AI
RAG
Agents
Graphs
Workflows
Security
Deployment
Monitoring
Recovery
Troubleshooting
59. TECHNOLOGY SELECTION

Do not introduce technology simply because it appears in this instruction.

Technology decisions must consider:

Requirements
Security
Performance
Maintainability
Team capability
Complexity
Cost
Existing stack
Deployment
Long-term support

Prefer the simplest architecture that meets the requirement.

However, where RAG/Agentic AI/Graph orchestration is genuinely required by the project, design it properly rather than creating a superficial implementation.

60. CHANGE MANAGEMENT

Every change must answer:

WHY?
WHAT?
WHERE?
IMPACT?
RISK?
SECURITY?
DATABASE IMPACT?
API IMPACT?
V1 IMPACT?
ROLLBACK?
TEST?
61. DO NOT CREATE FAKE FUNCTIONALITY

Never fake:

OAuth
WhatsApp integration
LinkedIn integration
Telegram integration
Email connection
API connection
RAG retrieval
Agent execution
Power BI integration
Security
Database migrations

If an external API requires approval/access/credentials, state:

REQUIRES EXTERNAL CONFIGURATION

Do not pretend it is complete.

62. DO NOT INVENT INFORMATION

If information is unavailable:

Inspect repository
Inspect documents
Inspect existing configuration
Inspect schema
Inspect dependencies

If still unavailable:

UNKNOWN

or

ASSUMPTION — REQUIRES CONFIRMATION

Never invent:

API fields
Credentials
Database tables
Provider capabilities
LinkedIn capabilities
Meta capabilities
Architecture
Security controls
63. IMPLEMENTATION PHASES

After approval, implement in controlled phases.

PHASE 1
Repository + Document Audit

PHASE 2
V1 Protection + V2 Branch

PHASE 3
Navigation Enhancement

PHASE 4
Communications Architecture

PHASE 5
Email Providers

PHASE 6
WhatsApp / Meta

PHASE 7
LinkedIn

PHASE 8
SMS

PHASE 9
Telegram

PHASE 10
Database / DBA Improvements

PHASE 11
AI Architecture

PHASE 12
RAG

PHASE 13
Agentic AI

PHASE 14
Agent Loops / Graph Workflows

PHASE 15
AI Security / RAG Security / Agent Security

PHASE 16
RBAC / Tenant Security

PHASE 17
Analytics Data Model

PHASE 18
Power BI Readiness

PHASE 19
Observability

PHASE 20
QA / Security / Performance Testing

PHASE 21
Staging

PHASE 22
Production Readiness

Do not attempt all phases as one uncontrolled modification.

64. FINAL ENGINEERING REPORT

After implementation, provide:

1. Executive Summary
2. Requirements Implemented
3. V1 Protection
4. V2 Architecture
5. Frontend Changes
6. Backend Changes
7. Database Changes
8. DBA Changes
9. Data Engineering
10. AI Engineering
11. RAG Architecture
12. Agentic AI
13. Agent Loops
14. Graph / Workflow Engineering
15. Multi-Agent Architecture
16. Communications Integrations
17. Security
18. OWASP
19. NIST
20. IAM / RBAC
21. Multi-Tenant Security
22. File Security
23. DevSecOps
24. Cloud
25. Networking
26. DevOps
27. SRE
28. QA / Testing
29. Performance
30. Observability
31. Analytics
32. Power BI
33. Backup / Disaster Recovery
34. Privacy
35. Compliance / GRC
36. Risks
37. Limitations
38. Technical Debt
39. NOT REQUIRED items
40. FUTURE items
41. Deployment
42. Rollback
43. Production Readiness
65. PRODUCTION READINESS STATUS

Use ONLY one:

NOT READY
CONDITIONALLY READY
PRODUCTION READY

Do not claim Production Ready because:

The application compiles
The UI looks good
A few manual tests passed
A provider form was created
An AI response was generated

Production readiness requires evidence across:

FUNCTIONALITY
+
SECURITY
+
DATABASE
+
INTEGRATIONS
+
AI/RAG
+
AGENTS
+
WORKFLOWS
+
PERFORMANCE
+
OBSERVABILITY
+
BACKUP/RECOVERY
+
REGRESSION
+
DEPLOYMENT
+
ROLLBACK
66. FINAL NON-NEGOTIABLE WORKFLOW

Before implementation:

READ DOCUMENT 1
        +
READ DOCUMENT 2
        ↓
INSPECT ENTIRE REPOSITORY
        ↓
UNDERSTAND V1
        ↓
MAP CURRENT ARCHITECTURE
        ↓
MAP DATABASE
        ↓
MAP APIs
        ↓
MAP INTEGRATIONS
        ↓
MAP AI / RAG / AGENTS
        ↓
COMPARE REQUIREMENTS
        ↓
IDENTIFY GAPS
        ↓
IDENTIFY CONFLICTS
        ↓
SECURITY ASSESSMENT
        ↓
DATABASE / DBA ASSESSMENT
        ↓
AI / RAG / AGENT ASSESSMENT
        ↓
GRAPH / LOOP / WORKFLOW ASSESSMENT
        ↓
DATA / ANALYTICS ASSESSMENT
        ↓
POWER BI ASSESSMENT
        ↓
DEVOPS / CLOUD / SRE ASSESSMENT
        ↓
QA / PERFORMANCE ASSESSMENT
        ↓
APPLICABILITY MATRIX
        ↓
V2 ARCHITECTURE
        ↓
GAPS + RISKS
        ↓
IMPLEMENTATION PLAN
        ↓
STOP
        ↓
WAIT FOR APPROVAL
        ↓
IMPLEMENT V2
        ↓
TEST
        ↓
SECURITY VALIDATION
        ↓
REGRESSION VALIDATION
        ↓
STAGING
        ↓
PRODUCTION READINESS
ABSOLUTE FINAL INSTRUCTION

DO NOT START CODING UNTIL THE PRE-IMPLEMENTATION ANALYSIS HAS BEEN PRESENTED.

DO NOT DESTROY OR REPLACE V1.

DO NOT MODIFY EXISTING WORKING FUNCTIONALITY WITHOUT A JUSTIFIED V2 REQUIREMENT.

DO NOT INTRODUCE TECHNOLOGY JUST FOR THE SAKE OF TECHNOLOGY.

DO NOT SKIP RAG, AI SECURITY, AGENT SECURITY, GRAPH/LOOP ENGINEERING, DATABASE/DBA, DATA ENGINEERING, CYBERSECURITY, IAM/RBAC, MULTI-TENANT SECURITY, QA, SRE, OBSERVABILITY, BACKUP/DR, OR POWER BI DATA MAPPING.

Every area must be assessed.

Every applicable area must be properly engineered.

Every non-applicable area must be explicitly marked NOT REQUIRED with a reason.

Every future capability must be explicitly marked FUTURE.

Never claim something is implemented unless it actually exists and has been validated.

Never claim something is secure without appropriate evidence.

Never claim production readiness without evidence.

V1 is the safety net. V2 must earn the right to replace it.