# Ganesyx — Team Project Management & Attendance

A full-stack, production-ready project management and attendance tracking web application with a dark industrial-professional design.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, CSS Modules, Recharts, Zustand
- **Backend**: Node.js + Express.js (TypeScript), REST API
- **Database**: MongoDB + Mongoose
- **Auth**: JWT (access + refresh tokens), HTTP-only cookies
- **PWA**: next-pwa with offline support
- **Containerization**: Docker + Docker Compose

## Features

- JWT authentication with refresh token rotation
- Project management with Kanban board (drag-and-drop)
- Task management with comments, time tracking, @mentions
- Attendance system with calendar view, check-in/out, work mode
- Team management with workload visualization
- Reports with burndown, velocity, and attendance charts
- Role-based access control (Admin, Manager, Member, Viewer)
- Notifications system
- PWA installable on mobile/desktop
- Fully responsive (320px - 1440px+)

## Quick Start (Development)

### Prerequisites

- Node.js 20+
- MongoDB running locally (or via Docker)

### Backend

```bash
cd backend
npm install
cp ../.env.example ../.env  # Edit with your values
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Seed Database

```bash
cd backend
npm run seed
```

**Login credentials after seeding:**

| Role    | Email              | Password    |
|---------|--------------------|-------------|
| Admin   | admin@ganesyx.com  | password123 |
| Manager | maya@ganesyx.com   | password123 |
| Member  | sarah@ganesyx.com  | password123 |

## Docker Deployment

### Build and run all services:

```bash
cp .env.example .env  # Edit with production values
docker-compose up -d --build
```

This starts:
- **MongoDB** on internal network
- **Backend API** on port 5000
- **Frontend** on port 3000

### With Nginx reverse proxy (for ganesyx.dexploit.space):

1. Copy `nginx/nginx.conf` to your Nginx sites config
2. Obtain SSL certificates with Certbot:
   ```bash
   sudo certbot --nginx -d ganesyx.dexploit.space
   ```
3. Reload Nginx:
   ```bash
   sudo nginx -s reload
   ```

## Environment Variables

| Variable                | Description                    | Default                              |
|-------------------------|--------------------------------|--------------------------------------|
| `PORT`                  | Backend port                   | `5000`                               |
| `MONGO_URI`             | MongoDB connection string      | `mongodb://localhost:27017/ganesyx_pm`|
| `JWT_SECRET`            | Access token secret            | (required)                           |
| `JWT_REFRESH_SECRET`    | Refresh token secret           | (required)                           |
| `JWT_EXPIRES_IN`        | Access token expiry            | `15m`                                |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token expiry           | `7d`                                 |
| `NEXT_PUBLIC_API_URL`   | Frontend API base URL          | `http://localhost:5000/api`          |

## API Endpoints

| Method | Path                          | Auth | Description                  |
|--------|-------------------------------|------|------------------------------|
| POST   | `/api/auth/register`          | No   | Register new user            |
| POST   | `/api/auth/login`             | No   | Login                        |
| POST   | `/api/auth/logout`            | No   | Logout                       |
| POST   | `/api/auth/refresh`           | No   | Refresh access token         |
| GET    | `/api/auth/me`                | Yes  | Current user profile         |
| GET    | `/api/projects`               | Yes  | List projects                |
| POST   | `/api/projects`               | Yes  | Create project (Manager+)    |
| GET    | `/api/projects/:id`           | Yes  | Project detail               |
| PUT    | `/api/projects/:id`           | Yes  | Update project               |
| DELETE | `/api/projects/:id`           | Yes  | Archive project (Admin)      |
| POST   | `/api/projects/:id/members`   | Yes  | Add member                   |
| DELETE | `/api/projects/:id/members/:u`| Yes  | Remove member                |
| GET    | `/api/tasks`                  | Yes  | List tasks (filter by project)|
| POST   | `/api/tasks`                  | Yes  | Create task                  |
| GET    | `/api/tasks/:id`              | Yes  | Task detail + comments       |
| PUT    | `/api/tasks/:id`              | Yes  | Update task                  |
| PUT    | `/api/tasks/:id/status`       | Yes  | Update status (Kanban)       |
| DELETE | `/api/tasks/:id`              | Yes  | Delete task                  |
| POST   | `/api/tasks/:id/comments`     | Yes  | Add comment                  |
| POST   | `/api/tasks/:id/log-hours`    | Yes  | Log time                     |
| POST   | `/api/attendance/check-in`    | Yes  | Check in                     |
| POST   | `/api/attendance/check-out`   | Yes  | Check out                    |
| GET    | `/api/attendance/my`          | Yes  | My attendance records        |
| GET    | `/api/attendance/team`        | Yes  | Team attendance (Manager+)   |
| GET    | `/api/attendance/stats`       | Yes  | Monthly stats                |
| GET    | `/api/team`                   | Yes  | Team members + task counts   |
| GET    | `/api/team/:id/workload`      | Yes  | Member workload              |
| PUT    | `/api/team/:id/role`          | Yes  | Change role (Admin)          |
| GET    | `/api/reports/burndown`       | Yes  | Burndown chart data          |
| GET    | `/api/reports/velocity`       | Yes  | Sprint velocity              |
| GET    | `/api/reports/attendance-summary`| Yes | Attendance summary          |

## Project Structure

```
├── frontend/          # Next.js 14 App Router
│   ├── src/
│   │   ├── app/       # Pages (auth, dashboard, projects, attendance, team, reports, settings)
│   │   ├── components/# Reusable components with CSS Modules
│   │   ├── hooks/     # Custom React hooks (useAuth, useProjects, useTasks, etc.)
│   │   ├── lib/       # API client, utilities
│   │   ├── store/     # Zustand auth store
│   │   └── types/     # TypeScript interfaces
│   └── public/        # PWA manifest, icons
├── backend/           # Express.js API
│   └── src/
│       ├── models/    # Mongoose schemas
│       ├── routes/    # Express routes
│       ├── controllers/ # Route handlers
│       ├── middleware/ # Auth, RBAC, error handling
│       └── scripts/   # Database seed
├── nginx/             # Reverse proxy config
└── docker-compose.yml
```
