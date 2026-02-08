# Validation Checklist for Issue #12 Implementation

Use this checklist to verify the automated timer system is working correctly.

## ✅ Pre-Deployment Checklist

### Database
- [ ] Run migrations: `python manage.py migrate`
- [ ] Verify migration applied: `python manage.py showmigrations website | grep 0264`
- [ ] Check TimeLog model has new fields in Django admin

### Configuration
- [ ] GitHub secrets configured (BLT_API_URL, BLT_API_TOKEN)
- [ ] Workflow file updated (`.github/workflows/status-sync.yml`)
- [ ] URLs configured (`/api/github-timer-webhook/` endpoint exists)

### Code Review
- [ ] All new files created (11 files)
- [ ] All modified files updated (7 files)
- [ ] No syntax errors in Python files
- [ ] No syntax errors in JavaScript files

## ✅ Functional Testing

### 1. Model Tests
```bash
cd BLT
python manage.py test website.tests.test_timelog.TimeLogModelTest
```

**Expected:** All tests pass

**Tests:**
- [ ] test_create_timelog
- [ ] test_pause_timelog
- [ ] test_pause_already_paused
- [ ] test_resume_timelog
- [ ] test_resume_not_paused
- [ ] test_duration_calculation
- [ ] test_get_active_duration
- [ ] test_get_active_duration_with_pause

### 2. API Tests
```bash
python manage.py test website.tests.test_timelog.TimeLogAPITest
```

**Expected:** All tests pass

**Tests:**
- [ ] test_start_timer_api
- [ ] test_stop_timer_api
- [ ] test_pause_timer_api
- [ ] test_pause_completed_timer
- [ ] test_resume_timer_api
- [ ] test_resume_not_paused_timer
- [ ] test_unauthorized_pause
- [ ] test_list_timelogs
- [ ] test_active_duration_in_response

### 3. Webhook Tests
```bash
python manage.py test website.tests.test_timelog.GitHubWebhookTest
```

**Expected:** All tests pass

**Tests:**
- [ ] test_issue_assigned_webhook
- [ ] test_issue_closed_webhook
- [ ] test_invalid_json_webhook

## ✅ Integration Testing

### Manual API Testing

#### 1. Start Timer
```bash
curl -X POST http://localhost:8000/api/timelogs/start/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "github_issue_number": 999,
    "github_repo": "test/repo",
    "github_issue_url": "https://github.com/test/repo/issues/999"
  }'
```

**Expected:**
- [ ] Status: 201 Created
- [ ] Response includes `id`, `start_time`
- [ ] `is_paused` is `false`
- [ ] `end_time` is `null`

#### 2. Get Active Timers
```bash
curl -H "Authorization: Token YOUR_TOKEN" \
     "http://localhost:8000/api/timelogs/?end_time__isnull=true"
```

**Expected:**
- [ ] Status: 200 OK
- [ ] Returns the timer created in step 1
- [ ] `active_duration` is a positive number

#### 3. Pause Timer
```bash
curl -X POST http://localhost:8000/api/timelogs/1/pause/ \
  -H "Authorization: Token YOUR_TOKEN"
```

**Expected:**
- [ ] Status: 200 OK
- [ ] `is_paused` is `true`
- [ ] `last_pause_time` is set

#### 4. Try to Pause Again (Should Fail)
```bash
curl -X POST http://localhost:8000/api/timelogs/1/pause/ \
  -H "Authorization: Token YOUR_TOKEN"
```

**Expected:**
- [ ] Status: 400 Bad Request
- [ ] Error message: "Time log is already paused."

#### 5. Resume Timer
```bash
curl -X POST http://localhost:8000/api/timelogs/1/resume/ \
  -H "Authorization: Token YOUR_TOKEN"
```

**Expected:**
- [ ] Status: 200 OK
- [ ] `is_paused` is `false`
- [ ] `paused_duration` is set
- [ ] `last_pause_time` is `null`

#### 6. Stop Timer
```bash
curl -X POST http://localhost:8000/api/timelogs/1/stop/ \
  -H "Authorization: Token YOUR_TOKEN"
```

**Expected:**
- [ ] Status: 200 OK
- [ ] `end_time` is set
- [ ] `duration` is calculated
- [ ] Duration excludes paused time

### GitHub Integration Testing

#### 1. Test Issue Assignment
1. [ ] Create a test issue in your repository
2. [ ] Assign it to yourself
3. [ ] Check Actions tab - workflow should run
4. [ ] Verify timer created in BLT:
   ```bash
   curl -H "Authorization: Token YOUR_TOKEN" \
        "http://localhost:8000/api/timelogs/?github_issue_number=ISSUE_NUMBER"
   ```

#### 2. Test Issue Closure
1. [ ] Close the test issue
2. [ ] Check Actions tab - workflow should run
3. [ ] Verify timer stopped:
   ```bash
   curl -H "Authorization: Token YOUR_TOKEN" \
        "http://localhost:8000/api/timelogs/TIMER_ID/"
   ```
4. [ ] Confirm `end_time` is set

#### 3. Test Project Status Change
1. [ ] Add issue to GitHub Project
2. [ ] Move to "In Progress" column
3. [ ] Check Actions tab - workflow should run
4. [ ] Verify timer started

### Webhook Testing

#### Test Webhook Endpoint Directly
```bash
curl -X POST http://localhost:8000/api/github-timer-webhook/ \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issues" \
  -d '{
    "action": "assigned",
    "issue": {
      "number": 123,
      "html_url": "https://github.com/test/repo/issues/123"
    },
    "assignee": {
      "login": "YOUR_USERNAME"
    },
    "repository": {
      "full_name": "test/repo"
    }
  }'
```

**Expected:**
- [ ] Status: 200 OK
- [ ] Response indicates timer started
- [ ] Timer exists in database

## ✅ UI Testing (If Implemented)

### Timer Widget
1. [ ] Load page with timer widget
2. [ ] Timer display shows 00:00:00
3. [ ] Start button is visible
4. [ ] Click start button
5. [ ] Timer starts counting
6. [ ] Stop/Pause buttons appear
7. [ ] Click pause button
8. [ ] Timer stops counting
9. [ ] Resume button appears
10. [ ] Click resume button
11. [ ] Timer resumes counting
12. [ ] Click stop button
13. [ ] Timer stops and resets

### JavaScript Console
```javascript
// In browser console
timerManager.startTimer()
// Wait a few seconds
timerManager.pauseTimer()
// Wait a few seconds
timerManager.resumeTimer()
// Wait a few seconds
timerManager.stopTimer()
```

**Expected:**
- [ ] No JavaScript errors
- [ ] Notifications appear for each action
- [ ] Timer display updates correctly

## ✅ Performance Testing

### Load Test
```bash
# Start 10 timers concurrently
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/timelogs/start/ \
    -H "Authorization: Token YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"github_issue_number\": $i}" &
done
wait
```

**Expected:**
- [ ] All requests succeed
- [ ] Response time < 1 second
- [ ] No database errors

### Duration Calculation Performance
```bash
# Get active duration for 100 timers
curl -H "Authorization: Token YOUR_TOKEN" \
     "http://localhost:8000/api/timelogs/?page_size=100"
```

**Expected:**
- [ ] Response time < 2 seconds
- [ ] All `active_duration` values calculated correctly

## ✅ Security Testing

### Permission Tests
1. [ ] User A cannot pause User B's timer
2. [ ] User A cannot stop User B's timer
3. [ ] User A cannot resume User B's timer
4. [ ] Unauthenticated requests are rejected
5. [ ] Invalid tokens are rejected

### Input Validation
```bash
# Test with invalid data
curl -X POST http://localhost:8000/api/timelogs/start/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"github_issue_number": "invalid"}'
```

**Expected:**
- [ ] Returns 400 Bad Request
- [ ] Error message is clear

## ✅ Edge Cases

### 1. Multiple Pause/Resume Cycles
- [ ] Pause and resume timer 5 times
- [ ] Verify `paused_duration` accumulates correctly
- [ ] Verify final duration excludes all paused time

### 2. Long-Running Timer
- [ ] Start timer
- [ ] Wait 1 hour (or use management command to simulate)
- [ ] Verify `active_duration` is accurate
- [ ] Stop timer
- [ ] Verify `duration` is correct

### 3. Concurrent Operations
- [ ] Try to pause and resume simultaneously
- [ ] Verify no race conditions
- [ ] Verify timer state is consistent

### 4. Stale Timer Cleanup
```bash
python manage.py sync_github_timers --stop-stale --dry-run
```

**Expected:**
- [ ] Identifies timers running > 24 hours
- [ ] Shows what would be stopped
- [ ] Doesn't actually stop in dry-run mode

## ✅ Documentation Review

- [ ] README.md is comprehensive
- [ ] API documentation is complete
- [ ] Code comments are clear
- [ ] Examples work as documented
- [ ] Troubleshooting section is helpful

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] All tests pass
- [ ] Code reviewed
- [ ] Documentation complete
- [ ] Migrations ready

### Deployment
- [ ] Backup database
- [ ] Run migrations
- [ ] Deploy code
- [ ] Restart services
- [ ] Verify health checks

### Post-Deployment
- [ ] Test one complete flow (start → pause → resume → stop)
- [ ] Monitor logs for errors
- [ ] Check GitHub Actions are triggering
- [ ] Verify webhooks are received

## ✅ Monitoring

### Metrics to Track
- [ ] Number of active timers
- [ ] Average timer duration
- [ ] Pause/resume frequency
- [ ] API response times
- [ ] Error rates

### Alerts to Set Up
- [ ] Timer API errors
- [ ] Webhook failures
- [ ] Stale timers (>24 hours)
- [ ] High API latency

## 📊 Test Results Summary

| Category | Tests | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Model Tests | 8 | | | |
| API Tests | 9 | | | |
| Webhook Tests | 3 | | | |
| Integration | 6 | | | |
| UI Tests | 13 | | | |
| Security | 5 | | | |
| Edge Cases | 4 | | | |
| **TOTAL** | **48** | | | |

## ✅ Sign-Off

- [ ] Developer: All functionality implemented and tested
- [ ] QA: All test cases pass
- [ ] DevOps: Deployment successful
- [ ] Product: Requirements met

**Date:** _______________

**Signed:** _______________

---

## 🎉 When All Checks Pass

**Issue #12 is COMPLETE and ready for production!**

The automated timer system is:
- ✅ Fully functional
- ✅ Well-tested
- ✅ Properly documented
- ✅ Production-ready
