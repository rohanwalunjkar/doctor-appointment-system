# DocBook - Doctor Appointment Booking System

A **full-stack** doctor appointment booking and time-slot management system built with **Python (FastAPI)**, **React**, and **MySQL**.

![Python](https://img.shields.io/badge/Python-3.9+-blue?logo=python)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green?logo=fastapi)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange?logo=mysql)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.3-blue?logo=tailwindcss)

## Features

### Patient Features
- **Doctor Search & Filters** — Search by specialization, rating, experience, fee, city
- **Smart Slot Booking** — Real-time availability with 14-day advance booking
- **Appointment Management** — View, cancel, and track appointment status
- **Reviews & Ratings** — Rate doctors after completed appointments (1-5 stars)
- **Notifications** — Real-time notifications for booking confirmations/updates
- **Profile Management** — Update personal info, change password

### Doctor Features
- **Schedule Management** — Set weekly recurring schedules (day, time, slot duration)
- **Auto Slot Generation** — System auto-generates individual time slots from schedules
- **Appointment Actions** — Confirm, complete, or reject appointments
- **Doctor Notes & Prescriptions** — Add clinical notes and prescriptions per appointment
- **Dashboard Analytics** — View total patients, revenue, average rating
- **Slot Blocking** — Block specific slots for unavailability

### Admin Features
- **User Management** — View, search, activate/deactivate users
- **System Analytics** — Total appointments, revenue, doctor/patient stats
- **Appointment Trends** — Visual trends over 30/60/90 days
- **Top Doctors Leaderboard** — Ranked by rating and patient count
- **Specialization Management** — Add/manage medical specializations

### Technical Highlights
- **JWT Authentication** with access + refresh token rotation
- **Role-based Access Control** (Patient / Doctor / Admin)
- **RESTful API** with auto-generated Swagger docs at `/api/docs`
- **Responsive UI** with Tailwind CSS (mobile-first)
- **Protected Routes** on frontend

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.9+, FastAPI, SQLAlchemy ORM, Pydantic v2 |
| **Frontend** | React 18, React Router v6, Axios, Tailwind CSS |
| **Database** | MySQL 8.0 |
| **Auth** | JWT (python-jose), bcrypt password hashing |
| **API Docs** | Swagger UI (auto-generated) |

## Project Structure

```
doctor-appointment-system/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Settings & env vars
│   │   ├── database.py          # DB engine & session
│   │   ├── models/
│   │   │   └── models.py        # SQLAlchemy models (8 tables)
│   │   ├── schemas/
│   │   │   └── schemas.py       # Pydantic request/response schemas
│   │   ├── routes/
│   │   │   ├── auth.py          # Register, Login, Refresh, Me
│   │   │   ├── users.py         # Profile CRUD, Admin user mgmt
│   │   │   ├── doctors.py       # Doctor profiles, schedules, specializations
│   │   │   ├── appointments.py  # Booking, slots, CRUD
│   │   │   ├── reviews.py       # Ratings & reviews
│   │   │   ├── notifications.py # User notifications
│   │   │   └── dashboard.py     # Analytics & statistics
│   │   └── utils/
│   │       ├── auth.py          # JWT, hashing, role guards
│   │       └── slots.py         # Time slot generation logic
│   ├── seed.py                  # Database seeder
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Router & route definitions
│   │   ├── main.jsx             # Entry point
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Auth state management
│   │   ├── services/
│   │   │   └── api.js           # Axios API service layer
│   │   ├── components/
│   │   │   ├── layout/          # Navbar, Footer
│   │   │   └── common/          # Loading, etc.
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Profile.jsx
│   │       ├── Notifications.jsx
│   │       ├── auth/            # Login, Register
│   │       ├── doctors/         # DoctorList, DoctorDetail
│   │       ├── appointments/    # Appointments
│   │       ├── doctor/          # Schedule management
│   │       └── admin/           # AdminUsers, AdminAnalytics
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── k8s/
│   ├── namespace.yaml           # Kubernetes namespace
│   ├── secrets.yaml             # DB credentials & JWT secret
│   ├── configmap.yaml           # App configuration
│   ├── mysql.yaml               # MySQL Deployment, PVC & Service
│   ├── backend.yaml             # Backend Deployment & Service
│   └── frontend.yaml            # Frontend Deployment & Service
├── docker-compose.yml
└── README.md
```

## Getting Started

### Option 1 — Run with Docker (Recommended)

The easiest way to run the full application. Requires only **Docker** and **Docker Compose**.

#### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

#### Steps

```bash
# 1. Clone the repository & navigate into it
cd doctor-appointment-system

# 2. Start all services (MySQL, Backend, Frontend)
docker-compose up --build
```

This will spin up **three containers**:

| Container | Service | URL |
|-----------|---------|-----|
| `docbook-mysql` | MySQL 8.0 database | `localhost:3306` |
| `docbook-backend` | FastAPI backend | [http://localhost:8000](http://localhost:8000) |
| `docbook-frontend` | React frontend | [http://localhost:3000](http://localhost:3000) |

#### Seed the Database (first time only)

Once all containers are running, open a **new terminal** and run:

```bash
docker exec -it docbook-backend python seed.py
```

This creates tables and populates sample doctors, patients, and schedules.

#### Useful Docker Commands

```bash
# Start in detached (background) mode
docker-compose up --build -d

# View logs
docker-compose logs -f

# View logs for a specific service
docker-compose logs -f backend

# Stop all services
docker-compose down

# Stop and remove all data (including MySQL volume)
docker-compose down -v

# Rebuild a specific service
docker-compose up --build backend
```

#### API Docs

Once running, Swagger UI is available at: **http://localhost:8000/api/docs**

---

### Option 2 — Deploy to Kubernetes

Deploy the application on a Kubernetes cluster using the manifests in the `k8s/` folder. Uses the official **MySQL 8.0** image from Docker Hub.

#### Prerequisites
- **Docker** (to build images)
- **kubectl** configured with access to your cluster
- A Kubernetes cluster (Minikube, Docker Desktop K8s, EKS, AKS, GKE, etc.)

#### Step 1 — Build Docker Images

```bash
cd doctor-appointment-system

# Build backend image
docker build -t docbook-backend:latest ./backend

# Build frontend image
docker build -t docbook-frontend:latest ./frontend
```

> **Note:** If deploying to a remote cluster, push images to a registry (Docker Hub, ECR, ACR, GCR) and update the `image` fields in `k8s/backend.yaml` and `k8s/frontend.yaml` accordingly:
> ```bash
> # Example: push to Docker Hub
> docker tag docbook-backend:latest <your-dockerhub-user>/docbook-backend:latest
> docker push <your-dockerhub-user>/docbook-backend:latest
>
> docker tag docbook-frontend:latest <your-dockerhub-user>/docbook-frontend:latest
> docker push <your-dockerhub-user>/docbook-frontend:latest
> ```

#### Step 2 — Apply Kubernetes Manifests

```bash
# Create namespace, secrets, and configmap
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# Deploy MySQL (uses mysql:8.0 from Docker Hub)
kubectl apply -f k8s/mysql.yaml

# Wait for MySQL to be ready
kubectl -n docbook rollout status deployment/mysql

# Deploy Backend
kubectl apply -f k8s/backend.yaml

# Deploy Frontend
kubectl apply -f k8s/frontend.yaml
```

#### Step 3 — Seed the Database (first time only)

```bash
# Get a backend pod name
kubectl -n docbook get pods -l tier=backend

# Run seed script inside the pod
kubectl -n docbook exec -it deployment/backend -- python seed.py
```

#### Step 4 — Access the Application

```bash
# Check all pods are running
kubectl -n docbook get pods

# Frontend is exposed via NodePort on port 30000
# Access at: http://<node-ip>:30000

# For local clusters (Minikube/Docker Desktop), use:
# http://localhost:30000

# To port-forward services locally:
kubectl -n docbook port-forward svc/frontend-service 3000:3000
kubectl -n docbook port-forward svc/backend-service 8000:8000
```

| Service | Internal DNS | Exposed Port |
|---------|-------------|-------------|
| MySQL | `mysql-service:3306` | ClusterIP (internal only) |
| Backend | `backend-service:8000` | ClusterIP (internal only) |
| Frontend | `frontend-service:3000` | NodePort `30000` |

#### Useful Kubectl Commands

```bash
# View logs
kubectl -n docbook logs -f deployment/backend
kubectl -n docbook logs -f deployment/frontend

# Scale replicas
kubectl -n docbook scale deployment/backend --replicas=3
kubectl -n docbook scale deployment/frontend --replicas=3

# Delete everything
kubectl delete namespace docbook
```

#### Kubernetes Architecture

```
┌──────────────────────────────────────────────────┐
│                Namespace: docbook                 │
│                                                  │
│  ┌──────────────┐   ┌──────────────────────────┐ │
│  │  MySQL 8.0   │   │  Backend (FastAPI) x2    │ │
│  │  (Docker Hub)│◄──│  docbook-backend:latest  │ │
│  │  ClusterIP   │   │  ClusterIP :8000         │ │
│  │  :3306       │   └──────────────────────────┘ │
│  │  + PVC 5Gi   │                                │
│  └──────────────┘   ┌──────────────────────────┐ │
│                     │  Frontend (React) x2     │ │
│                     │  docbook-frontend:latest  │ │
│                     │  NodePort :30000          │ │
│                     └──────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

### Option 3 — Run without Docker (Manual Setup)

### Prerequisites
- **Python 3.9+**
- **Node.js 18+**
- **MySQL 8.0**

### 1. Database Setup

```sql
CREATE DATABASE doctor_appointment_db;
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Edit .env with your MySQL credentials

# Run database seeder (creates tables + sample data)
python seed.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/api/docs**

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend available at: **http://localhost:3000**

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@docbook.com | admin123 |
| **Doctor** | dr.smith@docbook.com | doctor123 |
| **Patient** | patient1@test.com | patient123 |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login (get JWT) |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/me` | Get current user |

### Doctors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/doctors/` | List/search doctors |
| GET | `/api/doctors/{id}` | Get doctor profile |
| GET | `/api/doctors/specializations` | List specializations |
| POST | `/api/doctors/schedules` | Add weekly schedule |
| POST | `/api/doctors/{id}/generate-slots` | Generate time slots |

### Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/appointments/slots/{doctor_id}` | Get available slots |
| POST | `/api/appointments/` | Book appointment |
| GET | `/api/appointments/my` | My appointments |
| PATCH | `/api/appointments/{id}` | Update status/notes |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/patient/stats` | Patient dashboard |
| GET | `/api/dashboard/doctor/stats` | Doctor dashboard |
| GET | `/api/dashboard/admin/stats` | Admin dashboard |
| GET | `/api/dashboard/admin/appointment-trends` | Trends chart data |
| GET | `/api/dashboard/admin/top-doctors` | Top rated doctors |

## Screenshots

> Run the application and visit http://localhost:3000 to see the UI.

## Resume Description

> **DocBook — Doctor Appointment Booking System** *(Full Stack)*
> - Built a comprehensive doctor appointment booking system with **Python (FastAPI)** backend and **React** frontend connected to **MySQL** database
> - Implemented **JWT authentication** with access/refresh token rotation and **role-based access control** (Patient/Doctor/Admin)
> - Developed **smart time-slot management** engine that auto-generates bookable slots from doctor's weekly recurring schedules
> - Created **RESTful APIs** (25+ endpoints) for appointment booking, doctor search with filters, reviews/ratings, and real-time notifications
> - Built **responsive UI** with Tailwind CSS featuring patient dashboard, doctor schedule management, and admin analytics with data visualization
> - **Tech Stack:** Python, FastAPI, SQLAlchemy, React 18, MySQL, JWT, Tailwind CSS

## License

MIT
