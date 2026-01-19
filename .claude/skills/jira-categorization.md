# Jira Ticket Categorization Skill

This skill pulls tickets from Jira using a JQL query, categorizes them into predefined categories, and saves the results to a JSON file.

## Categories

Tickets must be classified into one of these categories:

| Category | Description |
|----------|-------------|
| `code-bug` | Bug fixes, defects, errors in existing code |
| `code-feature` | New features, enhancements requiring code changes |
| `research` | Investigation, spikes, POCs, documentation research |
| `no-code` | Administrative tasks, meetings, process changes, non-coding work |

## Output Location

All categorized tickets are saved to: `/Users/aviisakov/Desktop/tasks/`

## Instructions

### Step 1: Get Atlassian Cloud ID

First, retrieve the accessible Atlassian resources to get the cloud ID:

```
Use mcp__atlassian__getAccessibleAtlassianResources to get the cloud ID
```

### Step 2: Prompt for JQL Query

Ask the user for their JQL query. Common examples:
- `project = "PROJECT_KEY" AND sprint in openSprints()`
- `assignee = currentUser() AND status != Done`
- `project = "PROJECT_KEY" AND created >= -7d`

### Step 3: Search Jira Issues

Use the JQL query to fetch tickets:

```
Use mcp__atlassian__searchJiraIssuesUsingJql with:
- cloudId: <from step 1>
- jql: <user's JQL query>
- fields: ["summary", "description", "status", "issuetype", "priority", "assignee", "reporter", "created", "updated", "labels", "components", "fixVersions", "parent", "subtasks", "comment"]
- maxResults: 100
```

If there are more results, use `nextPageToken` to paginate through all tickets.

### Step 4: Categorize Each Ticket

For each ticket, analyze the following to determine the category:

1. **Issue Type**: Bug types → `code-bug`, Story/Task → analyze further
2. **Summary & Description**: Look for keywords
3. **Labels & Components**: May indicate category

**Categorization Logic:**

- **code-bug**: Issue type is Bug, Defect, or description mentions fixing/resolving errors
- **code-feature**: Issue type is Story/Feature, or involves building new functionality
- **research**: Contains keywords like "investigate", "research", "spike", "POC", "explore", "document"
- **no-code**: Administrative tasks, meetings, process updates, configuration without code

When uncertain, prefer this order: `code-feature` > `research` > `no-code`

### Step 5: Generate Output JSON

Create a JSON file with this structure:

```json
{
  "metadata": {
    "generatedAt": "<ISO timestamp>",
    "jqlQuery": "<the JQL query used>",
    "totalTickets": <count>,
    "categorySummary": {
      "code-bug": <count>,
      "code-feature": <count>,
      "research": <count>,
      "no-code": <count>
    }
  },
  "tickets": [
    {
      "key": "PROJECT-123",
      "summary": "Ticket summary",
      "description": "Full description text",
      "status": "In Progress",
      "issueType": "Story",
      "priority": "High",
      "assignee": {
        "displayName": "John Doe",
        "accountId": "abc123"
      },
      "reporter": {
        "displayName": "Jane Smith",
        "accountId": "def456"
      },
      "created": "2025-01-10T10:00:00Z",
      "updated": "2025-01-10T15:30:00Z",
      "labels": ["frontend", "urgent"],
      "components": ["UI"],
      "fixVersions": ["v2.0"],
      "parent": "PROJECT-100",
      "subtasks": ["PROJECT-124", "PROJECT-125"],
      "commentCount": 5,
      "category": "code-feature",
      "categoryReason": "New user dashboard feature requiring frontend changes"
    }
  ]
}
```

### Step 6: Save the File

Save the JSON to `/Users/aviisakov/Desktop/tasks/jira-tickets-<timestamp>.json`

Use the Write tool to create the file. The timestamp format should be: `YYYYMMDD-HHmmss`

Example: `jira-tickets-20250110-143022.json`

### Step 7: Summary

After saving, provide a summary to the user:

```
Categorized X tickets:
- code-bug: X tickets
- code-feature: X tickets
- research: X tickets
- no-code: X tickets

Saved to: /Users/aviisakov/Desktop/tasks/jira-tickets-<timestamp>.json
```

## Error Handling

- If no tickets match the JQL query, inform the user and don't create an empty file
- If Atlassian authentication fails, ask the user to check their MCP configuration
- If the output directory doesn't exist, create it before writing

## Example Usage

User: "Categorize my sprint tickets"

1. Get cloud ID
2. Ask: "What JQL query should I use? For example: `project = MYPROJECT AND sprint in openSprints()`"
3. User provides: `project = DEV AND sprint in openSprints()`
4. Fetch all matching tickets
5. Categorize each ticket
6. Save to `/Users/aviisakov/Desktop/tasks/jira-tickets-20250110-143022.json`
7. Display summary
