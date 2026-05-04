# DocBook — Project Logic & Architecture Explained

---

## 1. High-Level Overview

DocBook is a **full-stack doctor appointment booking system** with three user roles — **Patient**, **Doctor**, and **Admin**. It lets patients browse doctors, book time-slot-based appointments, leave reviews, and get notifications. Doctors manage their weekly schedule and appointment workflow. Admins oversee the entire platform.

```
┌─────────────┐        HTTP / REST API         ┌─────────────────┐        SQL         ┌─────────┐
│   Frontend   │  ──────────────────────────►   │     Backend     │  ──────────────►   │  MySQL  │
│  React/Vite  │  ◄──────────────────────────   │    FastAPI      │  ◄──────────────   │  8.0    │
│  Port 3000   │    JSON + JWT Bearer Token     │    Port 8000    │    SQLAlchemy      │  3306   │
└─────────────┘                                 └─────────────────┘                    └─────────┘
```

---

## 2. Tech Stack

| Layer      | Technology                                                    |
|------------|---------------------------------------------------------------|
| Frontend   | React 18, Vite 5, TailwindCSS 3.3, React Router v6, Axios    |
| Backend    | Python 3.11, FastAPI 0.104, SQLAlchemy 2.0, Pydantic v2      |
| Database   | MySQL 8.0                                                     |
| Auth       | JWT (python-jose), bcrypt via passlib                         |
| Infra      | Docker, Kubernetes (Kind), Docker Hub images                  |

---

## 3. Database Schema & Models

There are **8 tables** (7 main models + 1 enum-style helper):

### 3.1 `users`
- Central identity table for **all** roles (patient, doctor, admin).
- Fields: `id`, `email` (unique), `hashed_password`, `first_name`, `last_name`, `phone`, `role` (enum: patient/doctor/admin), `gender`, `date_of_birth`, `address`, `city`, `profile_image`, `is_active`, `is_verified`, `created_at`, `updated_at`.
- **Relationships:** One user can have one `DoctorProfile`, many `Appointment`s (as patient), many `Review`s (as patient), many `Notification`s.

### 3.2 `specializations`
- Lookup table for medical specializations (Cardiology, Dermatology, etc.).
- Fields: `id`, `name` (unique), `description`, `icon`.
- Seeded with 10 specializations on first run.

### 3.3 `doctor_profiles`
- Extended profile attached to a user with `role = doctor`.
- Fields: `id`, `user_id` (FK → users, unique), `specialization_id` (FK → specializations), `qualification`, `experience_years`, `consultation_fee`, `bio`, `hospital_name`, `hospital_address`, `average_rating`, `total_reviews`, `total_patients`, `is_available`, timestamps.
- **Key Logic:** `average_rating` and `total_reviews` are **denormalized** — updated every time a new review is submitted (calculated in the review creation endpoint). `total_patients` is incremented when an appointment is marked as "completed".

### 3.4 `doctor_schedules`
- Defines a doctor's **weekly recurring availability** (not specific dates).
- Fields: `id`, `doctor_id` (FK → doctor_profiles), `day_of_week` (enum: monday–sunday), `start_time`, `end_time`, `slot_duration_minutes` (default 30), `max_patients_per_slot`, `is_active`.
- **Unique Constraint:** `(doctor_id, day_of_week, start_time)` — a doctor cannot have duplicate schedules for the same day and hour.
- Example: Doctor #1 is available Monday 09:00–13:00 (30-min slots) → this generates 8 individual time slots per Monday.

### 3.5 `time_slots`
- **Concrete daily slots** generated from `doctor_schedules`.
- Fields: `id`, `doctor_id`, `date`, `start_time`, `end_time`, `is_booked`, `is_blocked`.
- **Unique Constraint:** `(doctor_id, date, start_time)`.
- **Index:** `(doctor_id, date)` for fast lookup.
- **Key Logic:** Slots are generated for the next 14 days whenever a new schedule is added or the doctor manually triggers regeneration. The generation function (`generate_slots_for_next_days`) iterates over each day, matches it to the weekday in the schedule, then creates slots in `slot_duration_minutes` increments from `start_time` to `end_time`. Existing slots are never duplicated (checked via the unique constraint query).

### 3.6 `appointments`
- Links a **patient** to a **doctor** at a specific **time slot**.
- Fields: `id`, `patient_id` (FK → users), `doctor_id` (FK → doctor_profiles), `time_slot_id` (FK → time_slots), `appointment_date`, `start_time`, `end_time`, `status` (enum: pending/confirmed/completed/cancelled/no_show), `reason`, `notes` (doctor's), `prescription`, timestamps.
- **Indexes:** `(patient_id, appointment_date)`, `(doctor_id, appointment_date)`.

### 3.7 `reviews`
- One review per completed appointment.
- Fields: `id`, `patient_id`, `doctor_id`, `appointment_id` (unique — only one review per appointment), `rating` (1–5), `comment`, `created_at`.

### 3.8 `notifications`
- In-app notification messages.
- Fields: `id`, `user_id`, `title`, `message`, `is_read`, `notification_type` (appointment/reminder/system), `created_at`.

### Entity-Relationship Summary

```
User ──1:1──► DoctorProfile ──1:N──► DoctorSchedule
                  │                        │
                  │                        ▼ (generates)
                  ├──1:N──► Appointment ◄──── TimeSlot
                  │              │
                  │              ├──1:1──► Review
                  │              │
                  ▼              ▼
           Specialization    Notification ◄── User
```

---

## 4. Authentication & Authorization Logic

### 4.1 Password Hashing
- Uses **passlib** with the **bcrypt** scheme.
- `hash_password(plain)` → bcrypt hash stored in `users.hashed_password`.
- `verify_password(plain, hashed)` → boolean comparison.

### 4.2 JWT Token Flow
1. **Login** (`POST /api/auth/login`): User sends `email` + `password` as `application/x-www-form-urlencoded` (OAuth2 standard form). Backend verifies credentials, then issues:
   - **Access Token** — expires in 30 minutes. Payload: `{ "sub": "<user_id_as_string>", "role": "patient|doctor|admin", "exp": ..., "type": "access" }`.
   - **Refresh Token** — expires in 7 days. Same payload but `"type": "refresh"`.
2. **Authenticated Requests**: Frontend sends `Authorization: Bearer <access_token>` with every API call (via Axios interceptor).
3. **Token Verification** (`verify_token`): Decodes JWT with `python-jose`, checks `type` matches expected ("access" vs "refresh").
4. **Token Refresh** (`POST /api/auth/refresh`): Client sends the refresh token in the body. Backend decodes it, looks up the user, issues a fresh pair of tokens.
5. **Get Current User** (`get_current_user` dependency): Extracts `sub` (user ID) from the access token, queries the database, returns the `User` object. Checks `is_active`.

### 4.3 Role-Based Access Control
Three FastAPI dependency functions gate access:
- `get_current_user` → any authenticated user
- `get_current_active_doctor` → user.role must be "doctor"
- `get_current_admin` → user.role must be "admin"

Routes inject these as `Depends(...)` to enforce access.

### 4.4 Frontend Auth Context
- `AuthContext` wraps the entire app.
- On mount, checks `localStorage` for `access_token`. If present, calls `GET /api/auth/me` to load the user.
- Provides: `user`, `login()`, `register()`, `logout()`, `isAuthenticated`, `isDoctor`, `isPatient`, `isAdmin`.
- **Auto Token Refresh**: The Axios response interceptor catches `401` errors, attempts to refresh using the stored refresh token, retries the original request, or redirects to `/login` if refresh fails.

---

## 5. Backend API Endpoints (Complete List)

### 5.1 Authentication (`/api/auth`)
| Method | Path        | Access  | Logic                                                      |
|--------|-------------|---------|-------------------------------------------------------------|
| POST   | `/register` | Public  | Create user. Patients are auto-verified; doctors are not.   |
| POST   | `/login`    | Public  | Verify credentials → return access + refresh JWT tokens.    |
| POST   | `/refresh`  | Public  | Given a refresh token → return a new token pair.            |
| GET    | `/me`       | Auth    | Return current user from token.                             |

### 5.2 Users (`/api/users`)
| Method | Path                    | Access  | Logic                                           |
|--------|-------------------------|---------|-------------------------------------------------|
| GET    | `/`                     | Admin   | List users with role / search filters + pagination. |
| GET    | `/{user_id}`            | Auth    | Get any user by ID.                              |
| PUT    | `/profile`              | Auth    | Update own profile (name, phone, address, etc.). |
| POST   | `/change-password`      | Auth    | Verify current password, set new one.            |
| PATCH  | `/{user_id}/toggle-active` | Admin | Flip `is_active` flag to enable/disable a user. |

### 5.3 Doctors (`/api/doctors`)
| Method | Path                          | Access  | Logic                                                        |
|--------|-------------------------------|---------|--------------------------------------------------------------|
| GET    | `/specializations`            | Public  | List all specializations.                                    |
| POST   | `/specializations`            | Admin   | Create a new specialization.                                 |
| GET    | `/`                           | Public  | Search doctors with filters (specialization, rating, fee, city, name). Paginated. |
| GET    | `/{doctor_id}`                | Public  | Get full doctor profile with user info and specialization.   |
| POST   | `/profile`                    | Doctor  | Create doctor profile for the logged-in doctor user.         |
| PUT    | `/profile`                    | Doctor  | Update own doctor profile.                                   |
| GET    | `/{doctor_id}/schedules`      | Public  | Get doctor's weekly schedule.                                |
| POST   | `/schedules`                  | Doctor  | Add a schedule slot → auto-generates time slots for 14 days. |
| PUT    | `/schedules/{schedule_id}`    | Doctor  | Update a schedule slot.                                      |
| DELETE | `/schedules/{schedule_id}`    | Doctor  | Delete a schedule slot.                                      |
| POST   | `/{doctor_id}/generate-slots` | Doctor  | Manually regenerate time slots for N days (default 14).      |

### 5.4 Appointments (`/api/appointments`)
| Method | Path                        | Access  | Logic                                                            |
|--------|-----------------------------|---------|------------------------------------------------------------------|
| GET    | `/slots/{doctor_id}`        | Public  | Get available (not booked, not blocked) time slots for a date range. |
| POST   | `/slots/block`              | Doctor  | Block specific time slots by ID (e.g., doctor unavailable).      |
| POST   | `/`                         | Auth    | Book an appointment: validate doctor, validate slot, create appointment, mark slot as booked, send notification to doctor. |
| GET    | `/my`                       | Auth    | Get current user's appointments (patient sees their own; doctor sees their patients'). Filterable by status. Paginated. |
| GET    | `/{appointment_id}`         | Auth    | Get single appointment details (authorized: patient, doctor, or admin). |
| PATCH  | `/{appointment_id}`         | Auth    | Update appointment (status change, notes, prescription). Logic: patients can only cancel; doctors can confirm/complete/cancel. Cancellation frees the time slot. Completion increments doctor's `total_patients`. A notification is sent on every update. |

### 5.5 Reviews (`/api/reviews`)
| Method | Path                  | Access  | Logic                                                           |
|--------|-----------------------|---------|-----------------------------------------------------------------|
| POST   | `/`                   | Auth    | Submit review for a **completed** appointment. Only patient who booked can review. Only one review per appointment. After creation, recalculates doctor's `average_rating` and `total_reviews`. |
| GET    | `/doctor/{doctor_id}` | Public  | Get all reviews for a doctor. Paginated.                        |

### 5.6 Notifications (`/api/notifications`)
| Method | Path                       | Access  | Logic                                      |
|--------|----------------------------|---------|--------------------------------------------|
| GET    | `/`                        | Auth    | Get own notifications (optionally unread only). Paginated. |
| GET    | `/unread-count`            | Auth    | Get count of unread notifications.          |
| PATCH  | `/{notification_id}/read`  | Auth    | Mark one notification as read.              |
| PATCH  | `/read-all`                | Auth    | Mark all notifications as read.             |

### 5.7 Dashboard (`/api/dashboard`)
| Method | Path                        | Access  | Logic                                                         |
|--------|-----------------------------|---------|---------------------------------------------------------------|
| GET    | `/patient/stats`            | Auth    | Count of appointments by status for the current patient.      |
| GET    | `/doctor/stats`             | Auth    | Appointment counts, total patients, revenue, average rating for the current doctor. |
| GET    | `/admin/stats`              | Admin   | System-wide: total appointments by status, total doctors, total patients, total revenue. |
| GET    | `/admin/appointment-trends` | Admin   | Appointments per day for the last N days (default 30).        |
| GET    | `/admin/top-doctors`        | Admin   | Top-rated doctors ranked by `average_rating`.                 |

---

## 6. Core Business Logic Flows

### 6.1 Appointment Booking Flow
```
Patient browses /doctors → Clicks a doctor → DoctorDetail page loads
    │
    ├── GET /api/doctors/{id} → fetch doctor profile
    ├── GET /api/reviews/doctor/{id} → fetch reviews
    └── GET /api/appointments/slots/{id}?date_from=...&date_to=... → fetch available slots
            │
            ▼
    Patient selects a date (next 14 days) and an available time slot
            │
            ▼
    Patient clicks "Confirm Booking"
            │
            ▼
    POST /api/appointments/ { doctor_id, time_slot_id, reason }
            │
            ├── Validate doctor exists and is_available
            ├── Validate time slot exists, belongs to doctor, not booked, not blocked
            ├── Create Appointment (status = "pending")
            ├── Mark TimeSlot.is_booked = True
            ├── Create Notification for doctor: "New Appointment Request"
            └── Return full appointment with patient & doctor details
```

### 6.2 Appointment Lifecycle (State Machine)
```
                ┌──────────┐
                │ PENDING  │
                └────┬─────┘
                     │
           ┌─────────┼─────────┐
           ▼                   ▼
    ┌──────────┐        ┌───────────┐
    │CONFIRMED │        │ CANCELLED │  ◄── Patient can cancel at pending/confirmed
    └────┬─────┘        └───────────┘      Doctor can cancel/reject at any stage
         │
    ┌────┼────────┐
    ▼              ▼
┌──────────┐  ┌─────────┐
│COMPLETED │  │ NO_SHOW │
└──────────┘  └─────────┘
     │
     ▼
  Patient can
  leave a Review
```

**Status change side effects:**
- **Cancelled** → Time slot is freed (`is_booked = False`), notification sent.
- **Completed** → Doctor's `total_patients` incremented by 1, notification sent.
- **Any change** → A notification is created for the other party.

### 6.3 Time Slot Generation Flow
```
Doctor adds a schedule: POST /api/doctors/schedules
  { day_of_week: "monday", start_time: "09:00", end_time: "13:00", slot_duration_minutes: 30 }
        │
        ▼
  generate_slots_for_next_days(db, doctor_id, days_ahead=14)
        │
        ├── For each of the next 14 days:
        │     ├── Check if the day's weekday matches the schedule's day_of_week
        │     └── If match → generate_time_slots_for_date()
        │               │
        │               ├── Start at schedule.start_time
        │               ├── Loop: create 30-min slots until schedule.end_time
        │               │     ├── Check if slot already exists (prevent duplicates)
        │               │     └── Create TimeSlot { doctor_id, date, start_time, end_time }
        │               └── Commit all new slots
        │
        └── Return total count of newly created slots
```

### 6.4 Review & Rating Calculation
```
Patient submits: POST /api/reviews/ { appointment_id, rating: 4, comment: "Great!" }
        │
        ├── Validate appointment is COMPLETED
        ├── Validate patient is the one who booked
        ├── Validate no existing review for this appointment
        │
        ├── Create Review record
        │
        └── Update DoctorProfile:
              ├── Fetch current avg rating from all existing reviews
              ├── new_avg = (old_avg × old_count + new_rating) / (old_count + 1)
              ├── doctor.average_rating = new_avg
              └── doctor.total_reviews = old_count + 1
```

---

## 7. Frontend Architecture

### 7.1 Entry Point & Providers
```
main.jsx
  └── React.StrictMode
        └── BrowserRouter
              └── AuthProvider (context)
                    ├── App (routes)
                    └── Toaster (react-hot-toast)
```

### 7.2 Route Structure
| Route                | Component        | Access         | Purpose                                  |
|----------------------|------------------|----------------|------------------------------------------|
| `/`                  | Home             | Public         | Landing page with features & CTA.        |
| `/login`             | Login            | Guest only     | Email/password login with demo accounts.  |
| `/register`          | Register         | Guest only     | Patient or Doctor registration.           |
| `/doctors`           | DoctorList       | Public         | Search & filter doctors.                  |
| `/doctors/:id`       | DoctorDetail     | Public         | Doctor profile, slots, booking, reviews.  |
| `/dashboard`         | Dashboard        | Authenticated  | Role-specific stats & quick actions.      |
| `/profile`           | Profile          | Authenticated  | Edit profile & change password.           |
| `/appointments`      | Appointments     | Authenticated  | View/manage bookings. Doctors can confirm/complete. |
| `/notifications`     | Notifications    | Authenticated  | View and mark notifications as read.      |
| `/schedule`          | Schedule         | Doctor only    | Manage weekly availability & generate slots. |
| `/admin/users`       | AdminUsers       | Admin only     | Search/filter users, activate/deactivate. |
| `/admin/analytics`   | AdminAnalytics   | Admin only     | Platform stats, top doctors, trends chart. |

### 7.3 Route Protection
- **`ProtectedRoute`** — Checks `isAuthenticated` from AuthContext. If not, redirects to `/login`. Optionally checks `allowedRoles` array.
- **`GuestRoute`** — If already authenticated, redirects to `/dashboard`. Prevents logged-in users from seeing login/register.

### 7.4 API Service Layer (`services/api.js`)
- Single Axios instance with `baseURL: '/api'` (proxied to backend via Vite dev server or Docker).
- **Request Interceptor:** Attaches `Authorization: Bearer <token>` from `localStorage`.
- **Response Interceptor:** On `401`, attempts to refresh the token using the stored refresh token. If that also fails, clears storage and redirects to `/login`. All errors show a toast notification.
- Separate API objects: `authAPI`, `usersAPI`, `doctorsAPI`, `appointmentsAPI`, `reviewsAPI`, `notificationsAPI`, `dashboardAPI`.

### 7.5 Key Frontend Patterns
- **State management:** React Context (AuthContext) for auth state; local `useState` for page data.
- **Data fetching:** `useEffect` on mount → call API → set state. No caching library.
- **Forms:** Controlled inputs with `useState`. Client-side validation (required fields, min lengths).
- **Toast notifications:** `react-hot-toast` for success/error messages (auto-triggered on API errors via interceptor).
- **UI components:** TailwindCSS utility classes, custom `.card`, `.badge`, `.btn-*`, `.input-field` classes defined in `index.css`.

---

## 8. Page-by-Page Logic

### 8.1 Home (`/`)
- Static landing page with hero section, stats, specialization cards (link to `/doctors?specialization=...`), feature grid, and a CTA to register.
- Shows "Find a Doctor" button if authenticated, or "Get Started" + "Log In" if not.

### 8.2 Login (`/login`)
- Form: email + password with show/hide toggle.
- Calls `login(email, password)` from AuthContext → `POST /api/auth/login` (sends as form-urlencoded per OAuth2 spec) → stores tokens → fetches user via `/auth/me` → redirects to `/dashboard`.
- **Demo Accounts:** Three pre-filled buttons (Patient, Doctor, Admin) auto-fill the form fields.

### 8.3 Register (`/register`)
- Role selector (Patient or Doctor), name, email, phone, gender, password with confirmation.
- Validates passwords match client-side.
- Calls `POST /api/auth/register` → on success, redirects to `/login` with a toast.
- Note: Patients are auto-verified; doctors' `is_verified` starts as `False`.

### 8.4 Doctor List (`/doctors`)
- Fetches specializations for the dropdown + fetches doctors with current filters.
- Filters: text search (by name), specialization dropdown, min rating, max fee.
- Each doctor card shows: initials avatar, name, specialization, qualification, rating, experience, fee, hospital name. Clicking navigates to `/doctors/:id`.

### 8.5 Doctor Detail (`/doctors/:id`)
- **Left Panel:** Doctor info card (avatar, name, specialization, qualification, rating, experience, fee, patients served, hospital, bio).
- **Right Panel (Tabs):**
  - **Book Appointment Tab:**
    1. Date selector — next 14 days as horizontal scrollable buttons.
    2. Time slots — fetched via `GET /api/appointments/slots/{id}?date_from=...`. Shows available slots as clickable buttons.
    3. Reason textarea (optional).
    4. Booking summary (appears when slot selected).
    5. "Confirm Booking" → `POST /api/appointments/`.
  - **Reviews Tab:** List of all reviews with patient name, star rating, comment, and date.

### 8.6 Dashboard (`/dashboard`)
- Fetches role-specific stats:
  - **Patient:** total/pending/completed/cancelled appointment counts.
  - **Doctor:** appointment counts + total patients + revenue + average rating.
  - **Admin:** system-wide appointment counts + total doctors + total patients + revenue.
- Shows stat cards, quick action links (Find Doctor, View Appointments, Manage Schedule, Update Profile), and a "Recent Appointments" table (last 5).

### 8.7 Appointments (`/appointments`)
- Tab-style status filter (All / Pending / Confirmed / Completed / Cancelled).
- Each appointment card shows: counterpart info (if patient → shows doctor; if doctor → shows patient), date, time, reason, status badge.
- **Doctor actions on pending:** Confirm or Reject buttons → `PATCH /api/appointments/{id} { status: "confirmed"|"cancelled" }`.
- **Doctor actions on confirmed:** Complete button.
- **Patient actions on pending/confirmed:** Cancel button.
- **Detail Modal:** Shows full appointment info. Doctor can add notes and prescription via textarea fields → `PATCH` with `{ notes, prescription }`. Patient sees doctor's notes/prescription in colored info boxes.

### 8.8 Schedule (`/schedule`) — Doctor Only
- Fetches the current doctor's profile (by searching for the logged-in user in the doctors list).
- Displays weekly schedule: 7 day rows, each showing schedule blocks with time ranges and slot durations. Delete button per schedule.
- "Regenerate Slots" button → `POST /api/doctors/{id}/generate-slots?days=14`.
- "Add Schedule" modal: Day dropdown, start/end time pickers, slot duration dropdown → `POST /api/doctors/schedules`.

### 8.9 Notifications (`/notifications`)
- Lists all notifications, newest first.
- Unread notifications have a blue left border and a dot indicator.
- Click a notification → marks as read via `PATCH /api/notifications/{id}/read`.
- "Mark All Read" button → `PATCH /api/notifications/read-all`.

### 8.10 Profile (`/profile`)
- Pre-filled form with current user data (first name, last name, phone, gender, date of birth, address, city).
- Save changes → `PUT /api/users/profile` → re-fetches user.
- "Change Password" expandable section → current password + new password + confirm → `POST /api/users/change-password`.

### 8.11 Admin: User Management (`/admin/users`)
- Search bar + role filter dropdown.
- Table: user avatar+name, email, role badge, active/inactive badge, join date, Activate/Deactivate button.
- Toggle → `PATCH /api/users/{id}/toggle-active`.

### 8.12 Admin: Analytics (`/admin/analytics`)
- Parallel fetches: admin stats + top 5 doctors + 30-day appointment trends.
- Stats row: total appointments, total doctors, total patients, total revenue.
- Two-column layout:
  - **Top Rated Doctors:** Ranked list with name, patient count, star rating.
  - **Appointment Trends (30 days):** Horizontal bar chart showing appointments per day (last 10 data points).

---

## 9. Seed Data

The `seed.py` script populates the database on first run:

| Type           | Records | Credentials                         |
|----------------|---------|--------------------------------------|
| Admin          | 1       | `admin@docbook.com` / `admin123`     |
| Doctors        | 5       | `dr.smith@docbook.com` / `doctor123` (and 4 others) |
| Patients       | 3       | `patient1@test.com` / `patient123`   (and 2 others) |
| Specializations| 10      | General Medicine, Cardiology, etc.   |
| Schedules      | 50      | Mon–Fri, 09:00–13:00 & 14:00–18:00 per doctor |
| Time Slots     | ~2800   | Auto-generated for 14 days × 5 doctors × 16 slots/day |

---

## 10. Configuration

All backend settings are in `app/config.py` via Pydantic `BaseSettings` (overridable by environment variables or `.env` file):

| Setting                        | Default                                    | Purpose                              |
|--------------------------------|--------------------------------------------|--------------------------------------|
| `DATABASE_URL`                 | `mysql+pymysql://root:password@localhost..` | SQLAlchemy connection string.        |
| `SECRET_KEY`                   | `your-super-secret-key...`                 | JWT signing key.                     |
| `ALGORITHM`                    | `HS256`                                    | JWT algorithm.                       |
| `ACCESS_TOKEN_EXPIRE_MINUTES`  | `30`                                       | Access token lifetime.               |
| `REFRESH_TOKEN_EXPIRE_DAYS`    | `7`                                        | Refresh token lifetime.              |
| `FRONTEND_URL`                 | `http://localhost:3000`                    | Allowed CORS origin.                 |
| `DEBUG`                        | `True`                                     | SQLAlchemy echo & debug mode.        |

---

## 11. Request/Response Flow (End-to-End Example)

**Example: Patient books an appointment**

```
1. Browser: User clicks "Confirm Booking" on DoctorDetail page
       │
2. Frontend: appointmentsAPI.create({ doctor_id: 1, time_slot_id: 42, reason: "Headache" })
       │
3. Axios: POST /api/appointments/
       │   Headers: Authorization: Bearer <access_token>
       │   Body: { "doctor_id": 1, "time_slot_id": 42, "reason": "Headache" }
       │
4. Vite Proxy: Forwards /api/* → http://localhost:8000 (or backend-service in K8s)
       │
5. FastAPI Router: appointments.router → create_appointment()
       │   Depends: get_db() → DB session
       │   Depends: get_current_user() → decode JWT → query User from DB
       │
6. Business Logic:
       ├── Query DoctorProfile where id=1 → found, is_available=True ✓
       ├── Query TimeSlot where id=42, doctor_id=1 → found, not booked, not blocked ✓
       ├── Create Appointment(patient_id=current_user.id, doctor_id=1, time_slot_id=42,
       │        appointment_date=slot.date, start_time=slot.start_time, ...)
       ├── Set slot.is_booked = True
       ├── Create Notification(user_id=doctor_user.id, title="New Appointment Request", ...)
       └── db.commit()
       │
7. Response: 201 Created
       {
         "id": 15, "patient_id": 7, "doctor_id": 1, "appointment_date": "2026-05-10",
         "start_time": "10:00:00", "end_time": "10:30:00", "status": "pending",
         "reason": "Headache", "patient": {...}, "doctor": {...}
       }
       │
8. Frontend: toast.success("Appointment booked successfully!")
       │   navigate("/appointments")
```

---

## 12. Key Design Decisions

1. **Time slots are pre-generated, not calculated on-the-fly.** This allows marking individual slots as booked/blocked and prevents race conditions.

2. **Denormalized ratings on DoctorProfile.** Avoids costly aggregate queries on every doctor list request. Trade-off: slight inconsistency risk, but the review endpoint handles the update atomically.

3. **Single `users` table for all roles** (instead of separate patient/doctor/admin tables). Simplifies auth and reduces joins. Doctor-specific data lives in the separate `doctor_profiles` table.

4. **OAuth2 form-based login** (`OAuth2PasswordRequestForm`). The standard expects `username` + `password` as form fields (not JSON), so the frontend sends `application/x-www-form-urlencoded` for the login endpoint specifically.

5. **JWT `sub` claim is a string.** The JWT spec requires `sub` to be a string. The user ID (integer) is converted to string when creating tokens and back to integer when querying the database.

6. **Vite proxy for API calls.** Frontend calls `/api/...` (relative), and Vite's dev server proxies these to the backend. In production/Docker, the Dockerfile uses `sed` to replace the proxy target URL.

7. **Notifications are database-stored, not real-time.** Simple polling approach — the frontend fetches notifications on page load. No WebSocket/SSE implementation.

---

## 13. File Structure Summary

```
backend/
├── app/
│   ├── main.py              → FastAPI app initialization, CORS, route registration
│   ├── config.py             → Pydantic settings (env vars)
│   ├── database.py           → SQLAlchemy engine, session, Base, get_db dependency
│   ├── models/models.py      → All SQLAlchemy ORM models (8 tables)
│   ├── schemas/schemas.py    → All Pydantic request/response schemas
│   ├── routes/
│   │   ├── auth.py           → Register, Login, Refresh, Me
│   │   ├── users.py          → User CRUD, password change, admin toggle
│   │   ├── doctors.py        → Doctor profiles, specializations, schedules, slot generation
│   │   ├── appointments.py   → Slot queries, appointment CRUD, status changes
│   │   ├── reviews.py        → Review creation, listing by doctor
│   │   ├── notifications.py  → Notification listing, mark read
│   │   └── dashboard.py      → Stats endpoints for each role
│   └── utils/
│       ├── auth.py           → Password hashing, JWT creation/verification, auth dependencies
│       └── slots.py          → Time slot generation logic
├── seed.py                   → Database seeder with sample data
└── requirements.txt          → Python dependencies

frontend/
├── src/
│   ├── main.jsx              → React entry point, providers (Router, Auth, Toaster)
│   ├── App.jsx               → Route definitions, ProtectedRoute/GuestRoute wrappers
│   ├── index.css             → TailwindCSS imports + custom utility classes
│   ├── context/AuthContext.jsx → Auth state management (user, tokens, login/logout)
│   ├── services/api.js       → Axios instance, interceptors, all API call functions
│   ├── components/
│   │   ├── layout/Navbar.jsx → Navigation bar with role-based links
│   │   ├── layout/Footer.jsx → Footer
│   │   └── common/Loading.jsx→ Loading spinner
│   └── pages/
│       ├── Home.jsx          → Landing page
│       ├── Dashboard.jsx     → Role-specific dashboard
│       ├── Profile.jsx       → Profile editing + password change
│       ├── Notifications.jsx → Notification list
│       ├── auth/Login.jsx    → Login form + demo accounts
│       ├── auth/Register.jsx → Registration form
│       ├── doctors/DoctorList.jsx   → Doctor search with filters
│       ├── doctors/DoctorDetail.jsx → Doctor profile + booking + reviews
│       ├── appointments/Appointments.jsx → Appointment management
│       ├── doctor/Schedule.jsx      → Doctor schedule management
│       ├── admin/AdminUsers.jsx     → User management table
│       └── admin/AdminAnalytics.jsx → Analytics dashboard
├── vite.config.js            → Vite config with API proxy
├── tailwind.config.js        → TailwindCSS configuration
└── package.json              → Node dependencies
```
