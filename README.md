# 🫀 Organ Transplant Matching & Critical Allocation Registry

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Java](https://img.shields.io/badge/Java-17+-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

A high-reliability, full-stack medical registry designed for **real-time organ allocation, ischemic viability tracking, and multi-criteria waitlist matching**.

The system pairs a **Node.js/Express REST backend and MongoDB persistence layer** with an ultra-fast, deterministic **Java 17 Matching Engine** over an IPC standard input/output bridge. It guarantees sub-millisecond candidate ranking, eliminates concurrency race conditions, and enforces fail-safe organ expiration routines.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Matching & Allocation Engine](#-matching--allocation-engine)
- [Cold Ischemia & Viability Standards](#-cold-ischemia--viability-standards)
- [Tech Stack](#-tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Quick Start](#-installation--quick-start)
- [Database Seeding & Default Credentials](#-database-seeding--default-credentials)
- [Running the Test Suites](#-running-the-test-suites)
- [REST API Reference](#-rest-api-reference)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Resilience & Fail-Safe Mechanics](#-resilience--fail-safe-mechanics)

---

## 🏗 System Architecture

The registry employs a hybrid decoupled architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Web Browser / Client                            │
│           React 18 SPA + Bootstrap 5.3 + Live Countdown Clocks         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST & JWT
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Node.js Express API                          │
│  - Authentication & RBAC Middleware (ADMIN, COORDINATOR, VIEWER)       │
│  - CRUD Controllers with Data Normalization & Validation               │
│  - Atomic Mongo State Transactions (No Double Allocations)             │
│  - Fallback Background Sweeper (Guarantees Expiry on Node layer)       │
│  - Tamper-evident Audit Logging Trail                                  │
└──────────────┬──────────────────────────────────────────▲──────────────┘
               │                                          │
       Mongoose Mapped Models                     JSON IPC Bridge (stdin/stdout)
               │                                          │
               ▼                                          ▼
┌──────────────────────────────┐       ┌─────────────────────────────────┐
│       MongoDB Database       │       │       Java 17 Engine Process    │
│  - Donors & Patients         │       │  - Deterministic PriorityQueue  │
│  - Organs & Allocations      │       │  - ABO Blood Compatibility Grid │
│  - Transplant Requests       │       │  - ViabilityMonitorThread       │
│  - Immutable Audit Logs      │       │  - Asynchronous Alert Events    │
└──────────────────────────────┘       └─────────────────────────────────┘
```

---

## ✨ Key Features

- **Multi-Factor Candidate Prioritization:** Real-time priority queuing driven by patient clinical urgency and elapsed waitlist time.
- **ABO/Rh Blood Compatibility Validation:** Prevents fatal immunological mismatches before allocation.
- **Active Ischemic Clock & Viability Tracking:** Dynamic countdowns calculating remaining viable hours down to the second.
- **Dual-Layer Expiry Sweeper:** Background Java viability daemon backed by a Node.js 30-second interval sweeper for zero-downtime safety.
- **Atomic Two-Phase Allocation:** Conditional MongoDB updates (`findOneAndUpdate` checks status transitions) preventing double-allocations under concurrent coordinator access.
- **Automatic Queue Restoration:** If an organ expires while allocated (pre-transplant), the recipient's request automatically reverts to `WAITING` without loss of queue seniority.
- **Complete Audit Trail:** Append-only event history tracking every creation, match, allocation, cancellation, and expiration.
- **Modern Responsive Dashboard:** Single-page application equipped with tabbed navigation, live status monitors, and one-click match inspection.

---

## 🧠 Matching & Allocation Engine

Candidate matching is calculated via a deterministic `PriorityQueue` comparator (`MatchingService.java`):

$$\text{Priority 1: Clinical Urgency Level } (5 \to 1)$$
$$\text{Priority 2: Waitlist Listing Timestamp (Earliest/FIFO First)}$$
$$\text{Priority 3: Request ID (Deterministic Tiebreaker)}$$

### ABO Blood Type Compatibility Matrix

| Donor Blood Type | Compatible Recipient Blood Types |
| :--- | :--- |
| **O-** | All types (Universal Red Cell Donor) |
| **O+** | O+, A+, B+, AB+ |
| **A-** | A-, A+, AB-, AB+ |
| **A+** | A+, AB+ |
| **B-** | B-, B+, AB-, AB+ |
| **B+** | B+, AB+ |
| **AB-** | AB-, AB+ |
| **AB+** | AB+ only (Universal Recipient) |

---

## ⏱ Cold Ischemia & Viability Standards

Organs expire strictly according to clinical viability limits measured from the time of harvesting (`harvestDatetime`):

| Organ Type | Maximum Viability (Hours) | Expiration Handling |
| :--- | :--- | :--- |
| **Heart** | 4 Hours | Auto-expires organ; triggers `ORGAN_EXPIRED` alert |
| **Lung** | 6 Hours | Auto-expires organ; triggers `ORGAN_EXPIRED` alert |
| **Intestine** | 8 Hours | Auto-expires organ; triggers `ORGAN_EXPIRED` alert |
| **Liver** | 12 Hours | Auto-expires organ; triggers `ORGAN_EXPIRED` alert |
| **Pancreas** | 12 Hours | Auto-expires organ; triggers `ORGAN_EXPIRED` alert |
| **Kidney** | 24 Hours | Auto-expires organ; triggers `ORGAN_EXPIRED` alert |

---

## 🛠 Tech Stack

### Backend
- **Node.js** (v18+) & **Express 4.19**
- **MongoDB** & **Mongoose 8**
- **JSON Web Tokens (jsonwebtoken)** & **bcryptjs**
- **Child Process IPC**: Asynchronous JSON stream communication (`services/javaBridge.js`)

### Compute & Matching Engine
- **Java 17 (OpenJDK)**: Zero external JAR dependencies; built strictly with native standard library tools (`java.util.concurrent`, `java.time`, `PriorityQueue`).

### Frontend
- **React 18** (UMD Standalone with client-side Babel compilation)
- **Bootstrap 5.3** & **Bootstrap Icons**
- Custom Dark Theme CSS with glassmorphism touches and mobile-responsive layouts

---

## 📁 Project Directory Structure

```text
organ-registry/
├── config/
│   └── db.js                    # MongoDB connection & transaction utilities
├── controllers/
│   ├── authController.js        # User authentication & registration
│   ├── crudFactory.js           # Generic pagination, search & guard router
│   ├── infoController.js        # Allocations, system audit & metrics
│   ├── organController.js       # Organ lifecycle, ranking & allocation
│   └── requestController.js     # Patient waitlist request management
├── java-engine/
│   ├── build.bat                # Windows build script (javac & jar)
│   ├── build.sh                 # Linux/macOS build script
│   └── src/com/organregistry/
│       ├── Main.java            # Standalone CLI test runner
│       ├── bridge/EngineCli.java# JSON-RPC line bridge (stdin/stdout)
│       ├── model/               # Organ, Patient, Request, Donor models
│       ├── service/             # MatchingService & AllocationService
│       ├── thread/              # ViabilityMonitorThread (daemon)
│       └── util/                # Json parser & BloodCompatibility matrix
├── middleware/
│   ├── auth.js                  # JWT extraction & RBAC verification
│   └── errorHandler.js          # Centralized error handler & DB guard
├── models/
│   ├── Allocation.js            # Organ allocation records
│   ├── AuditLog.js              # Append-only immutable log
│   ├── Donor.js                 # Organ donor profiles
│   ├── Organ.js                 # Organ tracking & computed expiry dates
│   ├── Patient.js               # Recipient patient profiles
│   ├── TransplantRequest.js     # Waitlist demand entries
│   ├── User.js                  # System user credentials & roles
│   └── index.js                 # Central export of all schemas
├── public/                      # Single-page application frontend
│   ├── css/style.css            # Dark slate UI theme & utility classes
│   ├── js/app.jsx               # React 18 frontend component tree
│   └── index.html               # Main entry HTML
├── routes/
│   └── index.js                 # Central API routing table
├── services/
│   ├── audit.js                 # Audit logger helper
│   ├── engineService.js         # Higher-level Java matching proxy
│   ├── eventBus.js              # In-memory EventEmitter
│   ├── javaBridge.js            # Process supervisor, restart backoff & timeouts
│   └── lifecycle.js             # Dual-layer expiry & rollback logic
├── utils/
│   └── http.js                  # Async handlers & HTTP error utilities
├── .env.example                 # Example configuration template
├── package.json                 # Project dependencies & npm scripts
├── seed.js                      # Database seeder with sample data
├── server.js                    # Server bootstrap & lifecycle init
├── test-api.js                  # End-to-end integration test suite
├── test-bridge.js               # Java IPC bridge unit tests
└── test-db.js                   # Mongoose schemas & validation tests
```

---

## ⚡ Prerequisites

Make sure the following are installed and added to your system `PATH`:

1. **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
2. **Java Development Kit (JDK)**: JDK 17 or higher ([Download OpenJDK](https://adoptium.net/))
3. **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017`) or a free [MongoDB Atlas Cluster](https://www.mongodb.com/atlas)

---

## 🚀 Installation & Quick Start

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/organ-registry.git
cd organ-registry
npm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Review or modify `.env` as needed:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/organ_registry
JWT_SECRET=super_secret_jwt_key_replace_in_production
JAVA_ENGINE_JAR=java-engine/out/organ-engine.jar
# Optional overrides:
# JAVA_BIN=java
# JAVA_TIMEOUT_MS=5000
```

### 3. Build the Java Matching Engine

Before starting the server, compile the Java engine:

**macOS / Linux:**
```bash
chmod +x java-engine/build.sh
npm run build:java
# or: sh java-engine/build.sh
```

**Windows:**
```cmd
java-engine\build.bat nodemo
```

*(This compiles the Java files into `java-engine/out/organ-engine.jar`.)*

### 4. Seed Initial Data

Populate the database with demo users, donors, recipients, organs, and waitlist requests:

```bash
node seed.js
```

### 5. Launch the Application

```bash
# Start server normally:
npm start

# Or start in development mode with nodemon:
npm run dev
```

Visit the interactive dashboard in your browser:
👉 **`http://localhost:3000`**

---

## 👥 Database Seeding & Default Credentials

Running `node seed.js` sets up the following test accounts:

| Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | `ADMIN` | Full control: delete records, allocate organs, view audit logs |
| **`coordinator1`** | `coord123` | `COORDINATOR` | Register patients/donors/organs, trigger allocations, cancel requests |
| **`dr_sharma`** | `doctor123` | `VIEWER` | Read-only access to lists, rankings, and dashboards |

---

## 🧪 Running the Test Suites

The repository contains three comprehensive test suites:

### 1. Database Schema & Validation Tests
Validates Mongoose indexes, unique constraints, invalid blood type rejections, and auto-computed `expiresAt`:
```bash
npm run test:db
```

### 2. Java Engine Bridge Tests
Validates IPC message passing, ranking algorithms, blood compatibility, engine timeout handling, and automatic process resurrection (no MongoDB needed):
```bash
npm run test:bridge
```

### 3. End-to-End API Test Suite
Launches a test server on port 3999, exercises authentication, patient creation, organ harvesting, match ranking, and atomic allocations:
```bash
npm run test:api
```

*(On Windows, you can also run `run-tests.bat` or `run-api-tests.bat` for one-click test execution.)*

---

## 📡 REST API Reference

All protected endpoints require an `Authorization: Bearer <token>` header.

### Authentication
- `POST /api/auth/login` — Login with username and password. Returns JWT token.
- `POST /api/auth/register` — Register a new account.
- `GET /api/auth/me` — Return currently authenticated user profile.

### Donors & Patients (CRUD)
- `GET /api/donors` — Paginated donor search (supports `?q=`, `?bloodType=`, `?page=`, `?limit=`).
- `POST /api/donors` — Register a new donor *(Requires consent verification before organ harvesting)*.
- `GET /api/donors/:id` — Get donor details.
- `PUT /api/donors/:id` — Update donor profile.
- `DELETE /api/donors/:id` — Remove donor *(Guarded: cannot delete donors with active organs)*.
- `GET /api/patients` — Paginated recipient list with medical condition & hospital.
- `POST /api/patients` — Register a new patient.
- `PUT /api/patients/:id` — Update patient information.
- `DELETE /api/patients/:id` — Remove patient *(Guarded: cannot delete patients with waiting requests)*.

### Organs & Allocation
- `POST /api/organs` — Register a newly harvested organ. Automatically calculates `expiresAt`.
- `GET /api/organs` — List organs (filter by `?status=AVAILABLE` or `?organType=KIDNEY`). Includes live `secondsRemaining`.
- `GET /api/organs/:id` — Retrieve specific organ timing and donor details.
- `GET /api/organs/:id/candidates` — **Live match preview**: calls Java engine to return prioritized, compatible candidates without locking the organ.
- `POST /api/organs/:id/allocate` — Allocates the organ to the #1 ranked candidate via atomic lock.
- `POST /api/organs/:id/confirm-transplant` — Marks an allocated organ as `TRANSPLANTED` and fulfills the waitlist request.

### Waitlist & Requests
- `POST /api/requests` — Submit a new organ transplant request with urgency `1` (lowest) to `5` (critical).
- `GET /api/requests` — View all active or fulfilled requests.
- `PATCH /api/requests/:id/cancel` — Cancel a waiting transplant request.

### Analytics & Audit
- `GET /api/allocations` — List historical allocation records.
- `GET /api/audit` — View chronological, append-only security and activity logs *(ADMIN / COORDINATOR only)*.
- `GET /api/stats` — Summary metrics: total patients, donors, organ statuses, and Java engine health.
- `GET /api/health` — System health check verifying MongoDB and Java engine status.

---

## 🛡 Role-Based Access Control (RBAC)

| Capability | ADMIN | COORDINATOR | VIEWER |
| :--- | :---: | :---: | :---: |
| View Dashboards & Lists | ✅ | ✅ | ✅ |
| Preview Candidate Rankings | ✅ | ✅ | ✅ |
| Register Patients & Donors | ✅ | ✅ | ❌ |
| Register Organs & Requests | ✅ | ✅ | ❌ |
| Execute Allocations | ✅ | ✅ | ❌ |
| Confirm Transplants | ✅ | ✅ | ❌ |
| Delete Records | ✅ | ❌ | ❌ |
| View System Audit Logs | ✅ | ✅ | ❌ |

---

## 🔒 Resilience & Fail-Safe Mechanics

1. **Concurrency Protection:**
   Allocations run with atomic MongoDB pre-conditions (`{ _id: organId, status: 'AVAILABLE' }`). If two coordinators simultaneously attempt to allocate the same organ, exactly one succeeds; the second receives an explicit `HTTP 409 Conflict`.
2. **Crash Recovery & Exponential Backoff:**
   If the Java engine process crashes or exits, `services/javaBridge.js` catches the event, cleanly rejects in-flight calls with `HTTP 503 Engine Down`, and automatically respawns the JVM with exponential backoff.
3. **Engine-Node Sync on Boot:**
   Whenever the server starts or the Java process restarts, `engine.syncFromDb()` automatically repopulates all live (`AVAILABLE` / `ALLOCATED`) organs into the Java memory watch-list.
4. **Queue Integrity on Premature Expiry:**
   If an organ reaches its ischemic limit after being matched, the allocation transitions to `FAILED` and the recipient's request reverts back to `WAITING`—ensuring critical patients retain their rightful place at the top of the queue.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
