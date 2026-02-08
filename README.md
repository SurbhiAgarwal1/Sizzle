# BLT Automated Timer for Issue Tracking

This GitHub Action automatically manages time tracking for issues by integrating with the BLT backend. When developers work on issues, timers start, pause, and stop automatically based on GitHub events.

## Features

- ✅ **Automatic Timer Start**: Timer starts when an issue is assigned or moved to "In Progress"
- ⏸️ **Pause/Resume**: Timer pauses when issue is unassigned and resumes when reassigned
- ⏹️ **Automatic Stop**: Timer stops when issue is closed
- 📊 **Duration Tracking**: Accurately tracks active work time, excluding paused periods
- 🔗 **GitHub Integration**: Links timers to specific GitHub issues
- 💾 **BLT Backend Storage**: All timer data stored on BLT backend

## Prerequisites

1. **BLT Backend**: A running BLT instance with the timer API endpoints
2. **GitHub Repository**: A GitHub repository with Projects V2 enabled
3. **API Token**: Valid API token for BLT backend authentication

## Setup

### 1. Configure Secrets

Go to your repository's **Settings > Secrets and variables > Actions** and add:

- `BLT_API_URL`: Your BLT backend API endpoint (e.g., `http://127.0.0.1:8000/api/github-timer-webhook/` for local or `https://your-blt-instance.com/api/github-timer-webhook/` for production)
- `BLT_API_TOKEN`: Your BLT API authentication token

**Legacy Support** (optional):
- `SIZZLE_API_URL`: Alternative to BLT_API_URL
- `SIZZLE_API_TOKEN`: Alternative to BLT_API_TOKEN

### 2. Workflow Configuration

The workflow is defined in `.github/workflows/status-sync.yml` and triggers on:

```yaml
on:
  project_v2_item:
    types: [edited, converted]
  issues:
    types: [assigned, unassigned, closed]
```

### 3. BLT Backend Setup

#### Run Migrations

```bash
cd BLT
python manage.py migrate
```

This creates the necessary database fields for pause/resume functionality.

#### Configure Webhook (Optional)

For direct webhook integration, configure GitHub webhooks:

1. Go to **Repository Settings > Webhooks > Add webhook**
2. Set Payload URL: `https://your-blt-instance.com/api/github-timer-webhook/`
3. Content type: `application/json`
4. Select events: `Issues`, `Projects`
5. Add webhook

## API Endpoints

### Timer Management

#### Start Timer
```bash
POST /api/timelogs/start/
Content-Type: application/json
Authorization: Bearer <token>

{
  "github_issue_url": "https://github.com/owner/repo/issues/123",
  "github_issue_number": 123,
  "github_repo": "owner/repo",
  "organization_url": "https://example.com"
}
```

#### Stop Timer
```bash
POST /api/timelogs/{id}/stop/
Authorization: Bearer <token>
```

#### Pause Timer
```bash
POST /api/timelogs/{id}/pause/
Authorization: Bearer <token>
```

#### Resume Timer
```bash
POST /api/timelogs/{id}/resume/
Authorization: Bearer <token>
```

#### Get Active Timer
```bash
GET /api/timelogs/?end_time__isnull=true
Authorization: Bearer <token>
```

### Webhook Endpoint

```bash
POST /api/github-timer-webhook/
Content-Type: application/json
X-GitHub-Event: issues

{
  "action": "assigned",
  "issue": {
    "number": 123,
    "html_url": "https://github.com/owner/repo/issues/123"
  },
  "assignee": {
    "login": "username"
  },
  "repository": {
    "full_name": "owner/repo"
  }
}
```

## Usage

### Automatic Timer Management

1. **Assign an issue** → Timer starts automatically
2. **Move to "In Progress"** in GitHub Projects → Timer starts
3. **Unassign the issue** → Timer pauses
4. **Close the issue** → Timer stops

### Manual Timer Control

Users can also manually control timers via the BLT web interface or API:

```javascript
// Start a timer
fetch('/api/timelogs/start/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    github_issue_url: 'https://github.com/owner/repo/issues/123',
    github_issue_number: 123,
    github_repo: 'owner/repo'
  })
});

// Pause timer
fetch('/api/timelogs/1/pause/', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});

// Resume timer
fetch('/api/timelogs/1/resume/', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});

// Stop timer
fetch('/api/timelogs/1/stop/', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});
```

## Verification

To verify the integration:

1. **Assign an issue** to yourself in your GitHub repository
2. Check the **Actions** tab to see the workflow run
3. Verify in BLT backend that a timer was created:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://your-blt-instance.com/api/timelogs/
   ```
4. Check the timer includes:
   - `github_issue_number`
   - `github_issue_url`
   - `github_repo`
   - `start_time`
   - `is_paused: false`

## Timer Data Model

Each timer includes:

- `user`: User who owns the timer
- `organization`: Associated organization (optional)
- `start_time`: When timer started
- `end_time`: When timer stopped (null if active)
- `duration`: Total active duration (excluding paused time)
- `github_issue_url`: Full URL to GitHub issue
- `github_issue_number`: Issue number
- `github_repo`: Repository (owner/repo format)
- `is_paused`: Whether timer is currently paused
- `paused_duration`: Total time spent paused
- `last_pause_time`: When timer was last paused
- `active_duration`: Real-time active duration (computed)

## Development

### Install Dependencies
```bash
npm install
```

### Run Locally
```bash
# Set environment variables
export GITHUB_TOKEN=your_github_token
export BLT_API_URL=http://localhost:8000/api/github-timer-webhook/
export BLT_API_TOKEN=your_blt_token

# Run the action
node src/index.js
```

### Run Tests
```bash
cd BLT
python manage.py test website.tests.test_timelog
```

## Troubleshooting

### Timer Not Starting

1. Check GitHub Actions logs for errors
2. Verify `BLT_API_URL` and `BLT_API_TOKEN` are set correctly
3. Ensure user's GitHub username matches their BLT username
4. Check BLT backend logs for webhook errors

### Timer Not Pausing/Resuming

1. Verify migrations have been run: `python manage.py migrate`
2. Check that timer is not already in the desired state
3. Ensure user has permission to modify the timer

### Duration Calculation Issues

The duration automatically excludes paused time:
- `total_duration = end_time - start_time`
- `active_duration = total_duration - paused_duration`

## Contributing

See [CONTRIBUTING.md](BLT/CONTRIBUTING.md) for guidelines.

## License

See [LICENSE.md](LICENSE.md) for details.
