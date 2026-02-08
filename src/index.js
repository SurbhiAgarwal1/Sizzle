const { Octokit } = require("@octokit/action");
const axios = require("axios");

async function run() {
  const octokit = new Octokit();
  const eventName = process.env.GITHUB_EVENT_NAME;

  console.log(`Processing event: ${eventName}`);

  // Read the payload (provided by GitHub Actions environment)
  const payload = require(process.env.GITHUB_EVENT_PATH);

  // Handle different event types
  if (eventName === "project_v2_item") {
    await handleProjectEvent(octokit, payload);
  } else if (eventName === "issues") {
    await handleIssueEvent(payload);
  } else {
    console.log(`Event ${eventName} not handled by this action.`);
  }
}

async function handleProjectEvent(octokit, payload) {
  const action = payload.action;
  const projectItem = payload.project_v2_item;

  console.log(`Project Action: ${action}`);
  console.log(`Content Type: ${projectItem.content_type}`);

  // We only care about edits (status changes are usually edits to the item)
  if (action !== "edited" && action !== "converted") {
    console.log("Action skipped.");
    return;
  }

  const itemId = projectItem.node_id;

  try {
    const query = `
      query($id: ID!) {
        node(id: $id) {
          ... on ProjectV2Item {
            id
            fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
              }
            }
            content {
              ... on Issue {
                number
                title
                url
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
                repository {
                  nameWithOwner
                }
              }
            }
          }
        }
      }
    `;

    const result = await octokit.graphql(query, { id: itemId });

    const statusValue = result.node?.fieldValueByName?.name;
    const issue = result.node?.content;

    console.log(`Current Status: ${statusValue}`);

    if (statusValue !== "In Progress") {
      console.log("Status is not 'In Progress'. Skipping timer trigger.");
      return;
    }

    if (!issue) {
      console.log("No issue content found.");
      return;
    }

    console.log(`Issue #${issue.number}: ${issue.title}`);
    console.log("Status is 'In Progress'. Starting timer...");

    // Send to BLT backend
    await sendToBLTBackend({
      action: "start_timer",
      issue_number: issue.number,
      issue_url: issue.url,
      repo_full_name: issue.repository.nameWithOwner,
      assignees: issue.assignees.nodes.map(a => a.login),
      status: statusValue
    });

  } catch (error) {
    console.error("Error fetching project item status via GraphQL:", error);
    return;
  }
}

async function handleIssueEvent(payload) {
  const action = payload.action;
  const issue = payload.issue;
  const assignee = payload.assignee;
  const repository = payload.repository;

  console.log(`Issue Action: ${action}`);
  console.log(`Issue #${issue.number}: ${issue.title}`);

  const eventData = {
    action: action,
    issue_number: issue.number,
    issue_url: issue.html_url,
    repo_full_name: repository.full_name,
    assignee: assignee ? assignee.login : null
  };

  // Send to BLT backend based on action
  if (action === "assigned") {
    eventData.action = "start_timer";
    console.log(`Issue assigned to ${assignee.login}. Starting timer...`);
  } else if (action === "closed") {
    eventData.action = "stop_timer";
    console.log("Issue closed. Stopping timer...");
  } else if (action === "unassigned") {
    eventData.action = "pause_timer";
    console.log("Issue unassigned. Pausing timer...");
  } else {
    console.log(`Action ${action} not handled.`);
    return;
  }

  await sendToBLTBackend(eventData);
}

async function sendToBLTBackend(data) {
  const bltApiUrl = process.env.BLT_API_URL || process.env.SIZZLE_API_URL;
  const bltToken = process.env.BLT_API_TOKEN || process.env.SIZZLE_API_TOKEN;

  if (!bltApiUrl) {
    console.error("Missing BLT_API_URL or SIZZLE_API_URL. Cannot send to backend.");
    return;
  }

  if (!bltToken) {
    console.error("Missing BLT_API_TOKEN or SIZZLE_API_TOKEN. Cannot authenticate.");
    return;
  }

  try {
    const response = await axios.post(bltApiUrl, {
      ...data,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Authorization': `Bearer ${bltToken}`,
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'timer-automation'
      }
    });

    console.log("Successfully sent to BLT backend:", response.data);
  } catch (error) {
    if (error.response) {
      console.error("BLT backend error:", error.response.status, error.response.data);
    } else {
      console.error("Failed to send to BLT backend:", error.message);
    }
  }
}

run();
