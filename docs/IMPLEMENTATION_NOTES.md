# Implementation notes

This MCP server uses the official Python MCP SDK pattern through FastMCP. It exposes tools, resources, and reusable prompts.

The server runs over stdio by default because that is the most common local MCP pattern for desktop clients. It also supports streamable HTTP through the command line transport option.

The public API clients are conservative by design. They use standard library HTTP calls, retry transient errors, normalize common CMS response shapes, and apply local filtering so the server remains resilient when CMS column names vary.

The analysis layer is intentionally proxy based. Public CMS data does not provide exact referral source leakage. The system ranks opportunity by public volume, public quality signals, and internal admissions history where you provide it.

The internal admissions CSV should not contain PHI unless your environment, access controls, vendor agreements, and organizational policies allow it. Prefer anonymous patient row ids.
