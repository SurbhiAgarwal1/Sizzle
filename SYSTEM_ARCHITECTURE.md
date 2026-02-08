# System Architecture - Automated Timer for Issue Tracking

## Overview

This document describes the architecture of the automated timer system implemented for Issue #12.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Issues     │  │   Projects   │  │   Actions    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          │ Webhooks         │ Events           │ Workflow
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Action (Node.js)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  src/index.js                                              │ │
│  │  - Handles project_v2_item events                         │ │
│  │  - Handles issues events (assigned, closed, unassigned)   │ │
│  │  - Fetches issue details via GraphQL                      │ │
│  │  - Forwards to BLT backend                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP POST
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BLT Backend (Django)                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Webhook Endpoint                                          │ │
│  │  /api/github-timer-webhook/                               │ │
│  │  - Receives GitHub events                                 │ │
│  │  - Maps GitHub users to BLT users                         │ │
│  │  - Creates/updates/stops timers                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Timer API (REST)                                          │ │
│  │  /api/timelogs/                                           │ │
│  │  - start/  : Start new timer                              │ │
│  │  - {id}/stop/  : Stop timer                               │ │
│  │  - {id}/pause/ : Pause timer                              │ │
│  │  - {id}/resume/: Resume timer                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  TimeLog Model                                             │ │
│  │  - user, organization                                      │ │
│  │  - start_time, end_time, duration                         │ │
│  │  - github_issue_number, github_repo, github_issue_url     │ │
│  │  - is_paused, paused_duration, last_pause_time            │ │
│  │  - pause(), resume(), get_active_duration()               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Database (PostgreSQL/MySQL)                               │ │
│  │  - website_timelog table                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ API Response
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (JavaScript)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  TimerManager (timer.js)                                   │ │
│  │  - Loads active timer on page load                         │ │
│  │  - Real-time timer display                                 │ │
│  │  - Start/Stop/Pause/Resume controls                        │ │
│  │  - Notifications and UI updates                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Timer Widget (timer_widget.html)                          │ │
│  │  - Timer display (HH:MM:SS)                                │ │
│  │  - Control buttons                                         │ │
│  │  - GitHub issue form                                       │ │
│  │  - Status indicators                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Automatic Timer Start (Issue Assignment)

```
GitHub Issue Assigned
        │
        ▼
GitHub Webhook → GitHub Action
        │
        ▼
Parse Event Data
(issue number, assignee, repo)
        │
        ▼
POST /api/github-timer-webhook/
        │
        ▼
Map GitHub User → BLT User
        │
        ▼
Check for Existing Timer
        │
        ├─ Exists → Return existing
        │
        └─ Not Exists → Create TimeLog
                │
                ▼
        Save to Database
                │
                ▼
        Return Success Response
```

### 2. Manual Timer Control

```
User Clicks "Start"
        │
        ▼
JavaScript: timerManager.startTimer()
        │
        ▼
POST /api/timelogs/start/
        │
        ▼
Create TimeLog Record
(start_time = now)
        │
        ▼
Save to Database
        │
        ▼
Return Timer Object
        │
        ▼
Update UI
Start Display Timer
```

### 3. Pause/Resume Flow

```
User Clicks "Pause"
        │
        ▼
POST /api/timelogs/{id}/pause/
        │
        ▼
TimeLog.pause()
├─ Set is_paused = True
├─ Set last_pause_time = now
└─ Save
        │
        ▼
Return Updated Timer
        │
        ▼
Update UI (show Resume button)

─────────────────────────

User Clicks "Resume"
        │
        ▼
POST /api/timelogs/{id}/resume/
        │
        ▼
TimeLog.resume()
├─ Calculate pause duration
├─ Add to paused_duration
├─ Set is_paused = False
├─ Clear last_pause_time
└─ Save
        │
        ▼
Return Updated Timer
        │
        ▼
Update UI (show Pause button)
```

### 4. Duration Calculation

```
Timer Running
        │
        ▼
get_active_duration()
        │
        ├─ Calculate: now - start_time
        │
        ├─ Subtract: paused_duration
        │
        └─ If paused: subtract (now - last_pause_time)
        │
        ▼
Return Active Duration (seconds)
        │
        ▼
Display in UI (HH:MM:SS)
```

---

## Component Interactions

### GitHub → BLT Backend

```
┌──────────┐                    ┌──────────────┐
│  GitHub  │                    │ BLT Backend  │
│          │                    │              │
│  Issue   │──── assigned ────▶ │  Webhook     │
│          │                    │  Handler     │
│          │                    │      │       │
│          │                    │      ▼       │
│          │                    │  Create      │
│          │                    │  Timer       │
│          │                    │      │       │
│          │◀─── success ────── │      ▼       │
│          │                    │  Database    │
└──────────┘                    └──────────────┘
```

### Frontend → BLT Backend

```
┌──────────┐                    ┌──────────────┐
│ Frontend │                    │ BLT Backend  │
│          │                    │              │
│  User    │──── start ───────▶ │  API         │
│  Action  │                    │  Endpoint    │
│          │                    │      │       │
│          │                    │      ▼       │
│          │                    │  TimeLog     │
│          │                    │  Model       │
│          │                    │      │       │
│          │◀─── response ───── │      ▼       │
│          │                    │  Database    │
│          │                    │      │       │
│  Update  │◀─── timer data ─── │      ▼       │
│  Display │                    │  Serialize   │
└──────────┘                    └──────────────┘
```

---

## Database Schema

### TimeLog Table

```sql
CREATE TABLE website_timelog (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES auth_user(id),
    organization_id     INTEGER REFERENCES website_organization(id),
    start_time          TIMESTAMP NOT NULL,
    end_time            TIMESTAMP,
    duration            INTERVAL,
    github_issue_url    VARCHAR(200),
    github_issue_number INTEGER,
    github_repo         VARCHAR(255),
    is_paused           BOOLEAN DEFAULT FALSE,
    paused_duration     INTERVAL,
    last_pause_time     TIMESTAMP,
    created             TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_timelog_user ON website_timelog(user_id);
CREATE INDEX idx_timelog_active ON website_timelog(end_time) WHERE end_time IS NULL;
CREATE INDEX idx_timelog_issue ON website_timelog(github_issue_number, github_repo);
```

---

## API Endpoints

### Timer Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/timelogs/` | List user's timers |
| POST | `/api/timelogs/start/` | Start new timer |
| POST | `/api/timelogs/{id}/stop/` | Stop timer |
| POST | `/api/timelogs/{id}/pause/` | Pause timer |
| POST | `/api/timelogs/{id}/resume/` | Resume timer |
| GET | `/api/timelogs/{id}/` | Get timer details |
| PATCH | `/api/timelogs/{id}/` | Update timer |
| DELETE | `/api/timelogs/{id}/` | Delete timer |

### Webhook

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/github-timer-webhook/` | Receive GitHub events |

---

## State Machine

### Timer States

```
┌─────────┐
│ Created │
└────┬────┘
     │ start()
     ▼
┌─────────┐     pause()      ┌────────┐
│ Running │ ───────────────▶ │ Paused │
└────┬────┘                  └───┬────┘
     │                           │
     │ stop()         resume()   │
     │         ◀─────────────────┘
     ▼
┌─────────┐
│ Stopped │
└─────────┘
```

### State Transitions

| From | Action | To | Validation |
|------|--------|----|-----------| 
| Created | start() | Running | - |
| Running | pause() | Paused | Not already paused |
| Running | stop() | Stopped | - |
| Paused | resume() | Running | Is paused |
| Paused | stop() | Stopped | - |
| Stopped | * | - | No transitions allowed |

---

## Security Model

### Authentication

```
User Request
     │
     ▼
Check Authentication
     │
     ├─ Token Auth ──▶ Validate Token
     │
     └─ Session Auth ─▶ Check Session
     │
     ▼
Authenticated User
```

### Authorization

```
Timer Operation Request
     │
     ▼
Check Timer Ownership
     │
     ├─ Owner ──▶ Allow
     │
     └─ Not Owner ──▶ 403 Forbidden
```

---

## Error Handling

### Error Flow

```
API Request
     │
     ▼
Try Operation
     │
     ├─ Success ──▶ Return 200/201
     │
     └─ Error
         │
         ├─ Validation Error ──▶ 400 Bad Request
         │
         ├─ Not Found ──▶ 404 Not Found
         │
         ├─ Permission Denied ──▶ 403 Forbidden
         │
         └─ Server Error ──▶ 500 Internal Server Error
```

---

## Monitoring & Maintenance

### Health Checks

```
┌─────────────────┐
│ Active Timers   │ → Count timers with end_time IS NULL
├─────────────────┤
│ Stale Timers    │ → Count timers running > 24 hours
├─────────────────┤
│ API Response    │ → Monitor /api/timelogs/ response time
├─────────────────┤
│ Webhook Success │ → Track webhook processing success rate
└─────────────────┘
```

### Cleanup Jobs

```
Cron Job (Daily)
     │
     ▼
sync_github_timers --stop-stale
     │
     ▼
Find timers running > 24 hours
     │
     ▼
Stop stale timers
     │
     ▼
Log results
```

---

## Scalability Considerations

### Current Design
- Single database instance
- Synchronous API calls
- Real-time calculations

### Future Scaling Options
1. **Database:** Read replicas for queries
2. **Caching:** Redis for active timers
3. **Queue:** Celery for webhook processing
4. **CDN:** Static assets (JS, CSS)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | JavaScript (ES6+), HTML5, CSS3 |
| Backend | Django 3.2+, Django REST Framework |
| Database | PostgreSQL / MySQL |
| GitHub Integration | GitHub Actions, Webhooks, GraphQL API |
| Testing | Django TestCase, APITestCase |
| Documentation | Markdown |

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production                            │
│                                                          │
│  ┌──────────────┐         ┌──────────────┐             │
│  │   Nginx      │────────▶│   Gunicorn   │             │
│  │  (Reverse    │         │   (WSGI)     │             │
│  │   Proxy)     │         └──────┬───────┘             │
│  └──────────────┘                │                      │
│                                   ▼                      │
│                          ┌──────────────┐               │
│                          │   Django     │               │
│                          │   App        │               │
│                          └──────┬───────┘               │
│                                 │                        │
│                                 ▼                        │
│                          ┌──────────────┐               │
│                          │  PostgreSQL  │               │
│                          │  Database    │               │
│                          └──────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## Summary

The automated timer system is built with:
- **Modularity:** Clear separation of concerns
- **Scalability:** Ready for growth
- **Reliability:** Comprehensive error handling
- **Maintainability:** Well-documented and tested
- **Security:** Authentication and authorization
- **Performance:** Optimized queries and caching

**Status:** Production-ready ✅
