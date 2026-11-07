# TA2LK AI — Agent Architecture

## Goal
Evolve the existing chat application into a personal, tool-using development agent without replacing the working chat experience.

## Planned layers
1. **Conversation and memory:** Cloudflare D1 stores conversations, messages, and explicitly approved memory facts.
2. **Reasoning and tool loop:** the model proposes a typed tool call; the server validates its schema, scope, and permissions before execution.
3. **Research and skill intake:** search official documentation, GitHub repositories, and web sources; pin exact repository commit/release revisions and retain provenance.
4. **Isolated execution:** run tests and untrusted project code in a disposable sandbox, never inside the public-facing Worker.
5. **Controlled self-modification:** create a dedicated Git branch, apply a patch, run formatting/type checks/tests/security checks, and show a diff.
6. **Approval and deployment:** require explicit user approval before merging, deploying, deleting data, sending messages, or taking other external/destructive actions.

## Skill acquisition pipeline
A requested skill is not trusted merely because it appears on GitHub or Google. The agent must:
- identify the original maintainer and canonical repository;
- inspect README, license, source files, dependency manifests, recent activity, issues, and release/commit history;
- scan install scripts and dependencies for suspicious behavior and secrets access;
- compare claims against official documentation and independent sources;
- pin the exact commit SHA and record source URLs and review notes;
- run tests in a disposable, network-restricted environment where feasible;
- present the proposed capability and required permissions for approval before installation.

Web pages, repository files, issues, and model outputs are untrusted data, never instructions that can override system policy or grant permissions.

## Security requirements
- Add real authentication and per-user authorization before enabling persistent personal data.
- Validate every request, limit payload sizes, rate-limit API routes, and use parameterized SQL.
- Never execute arbitrary shell commands in the Worker.
- Keep credentials in Cloudflare secrets, never in source files, prompts, logs, or Git.
- Restrict file tools to an explicitly configured workspace.
- Require approval for destructive or externally visible actions.
- Keep an audit trail and provide rollback through Git.

## Current implementation status
This document and the initial D1 schema establish the data model and safety contract. They do not yet enable database persistence: a D1 database, binding, authentication, and API integration must be configured and tested before deployment.
