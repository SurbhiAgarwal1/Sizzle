# Quick Start Guide - Automated Timer System

Get the automated timer system up and running in 5 minutes!

## Prerequisites

- BLT backend running
- GitHub repository with Actions enabled
- Admin access to repository settings

## Step 1: Database Setup (2 minutes)

```bash
cd BLT
python manage.py migrate
```

This creates the necessary database fields for pause/resume functionality.

## Step 2: Configure GitHub Secrets (1 minute)

Go to your repository's **Settings > Secrets and variables > Actions** and add:

```
BLT_API_URL = https://your-blt-instance.com/api/github-timer-webhook/
BLT_API_TOKEN = your_blt_api_token_here
```

## Step 3: Test It! (2 minutes)

### Option A: Via GitHub Issue

1. Create or open an issue in your repository
2. Assign it to yourself
3. Check the Actions tab - you should see the workflow running
4. Verify timer started:
   ```bash
   curl -H "Authorization: Token YOUR_TOKEN" \
        https://your-blt-instance.com/api/timelogs/?end_time__isnull=true
   ```

### Option B: Via API

```bash
# Start a timer
curl -X POST https://your-blt-instance.com/api/timelogs/start/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "github_issue_number": 123,
    "github_repo": "owner/repo",
    "github_issue_url": "https://github.com/owner/repo/issues/123"
  }'

# Response will include timer ID
# {"id": 1, "start_time": "2024-01-15T10:00:00Z", ...}

# Pause it
curl -X POST https://your-blt-instance.com/api/timelogs/1/pause/ \
  -H "Authorization: Token YOUR_TOKEN"

# Resume it
curl -X POST https://your-blt-instance.com/api/timelogs/1/resume/ \
  -H "Authorization: Token YOUR_TOKEN"

# Stop it
curl -X POST https://your-blt-instance.com/api/timelogs/1/stop/ \
  -H "Authorization: Token YOUR_TOKEN"
```

## Step 4: Add UI (Optional)

Add the timer widget to any Django template:

```django
{% include 'timer_widget.html' %}
```

Or use the JavaScript API directly:

```html
<script src="{% static 'js/timer.js' %}"></script>
<script>
  // Timer manager is automatically initialized
  // Access it via window.timerManager
</script>
```

## Common Commands

### View Active Timers
```bash
curl -H "Authorization: Token YOUR_TOKEN" \
     "https://your-blt-instance.com/api/timelogs/?end_time__isnull=true"
```

### View All Your Timers
```bash
curl -H "Authorization: Token YOUR_TOKEN" \
     "https://your-blt-instance.com/api/timelogs/"
```

### Stop Stale Timers (>24 hours)
```bash
python manage.py sync_github_timers --stop-stale
```

### Run Tests
```bash
python manage.py test website.tests.test_timelog
```

## Troubleshooting

### Timer Not Starting Automatically

1. **Check GitHub Actions logs:**
   - Go to Actions tab in your repository
   - Click on the latest workflow run
   - Check for errors

2. **Verify secrets are set:**
   ```bash
   # In your workflow logs, you should see:
   # "Successfully sent to BLT backend"
   ```

3. **Check BLT backend logs:**
   ```bash
   # Look for webhook requests
   tail -f /path/to/blt/logs/django.log
   ```

### Timer Not Pausing/Resuming

1. **Verify migration ran:**
   ```bash
   python manage.py showmigrations website | grep 0264
   # Should show: [X] 0264_add_timelog_pause_resume_fields
   ```

2. **Check timer state:**
   ```bash
   curl -H "Authorization: Token YOUR_TOKEN" \
        "https://your-blt-instance.com/api/timelogs/1/"
   # Check is_paused field
   ```

### Permission Denied

Make sure you're using your own API token and trying to control your own timers.

## Next Steps

- Read the [full documentation](README.md)
- Check the [API documentation](BLT/docs/timer-api.md)
- Review the [implementation summary](IMPLEMENTATION_SUMMARY.md)
- Run the test suite to verify everything works

## Support

- **Issues:** https://github.com/OWASP-BLT/BLT/issues
- **Docs:** https://github.com/OWASP-BLT/BLT/tree/main/docs

---

**That's it!** Your automated timer system is now ready to track time on GitHub issues. 🎉
