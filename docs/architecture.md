# CyberMorph Frontend Architecture

## 1. System Overview

CyberMorph is a cybersecurity educational mobile simulation game accompanied by a web-based portal for account management, progress monitoring, classroom management, and leaderboard functionality. The mobile application is developed using the Godot Engine, while the companion web portal is developed using Vue.js. FastAPI serves as the backend framework responsible for API-based communication and server-side processing, while PostgreSQL functions as the primary cloud database for persistent online data. The mobile application also utilizes a local SQLite database to support offline gameplay and local data persistence.

The system incorporates three user roles:

- Player
- Educator
- Admin

The system follows an offline-first design in which gameplay can continue using locally stored data, while authenticated online users can synchronize relevant gameplay information with the cloud system.

## 2. Major Components

### 2.1 Godot Game Client

The Godot Game Client is the primary mobile application through which players interact with the CyberMorph cybersecurity simulation. It is responsible for executing gameplay mechanics, maps, NPC behavior, assessments, threat simulations, and the adaptive attacker AI. The client also maintains local gameplay data through SQLite to support offline operation.

The game uses a pre-trained Reinforcement Learning model for adaptive attacker behavior and Dynamic Difficulty Adjustment. The AI operates using locally available gameplay information so that adaptive gameplay can continue without requiring an active internet connection.

### 2.2 Vue.js Web Portal

The Vue.js Web Portal provides the browser-based interface for online system functionality. It supports account-related operations and web-based functionality for Players, Educators, and Admins, including player progress, classroom management, analytics, leaderboard access, and administrative operations.

The web portal communicates with the FastAPI backend through HTTP-based API requests rather than directly accessing the PostgreSQL database.

### 2.3 FastAPI Backend

FastAPI serves as the backend and API layer of the CyberMorph system. It provides the server-side application logic, API endpoints, authentication, authorization, validation, and communication with the PostgreSQL database.

The backend is organized into feature-oriented modules including:

- Authentication
- Players
- Sessions
- Leaderboard
- Classroom
- Educator / Web Users
- Admin
- Synchronization

The backend uses asynchronous processing and SQLAlchemy's asynchronous database engine/session according to the backend rewrite plan.

### 2.4 Local SQLite Database

SQLite provides local data persistence for the Godot mobile application. It supports offline gameplay by storing locally generated player and gameplay records without requiring continuous network access.

The local design includes data for:

- Player information
- Game sessions
- Scores
- Threat Index
- Threat attack events
- AI state
- Pending synchronization records

The `pending_sync_queue` stores records that still need to be transferred to the cloud.

### 2.5 PostgreSQL Cloud Database

PostgreSQL serves as the primary cloud database for persistent online system data. It stores user accounts, player profiles, gameplay sessions, leaderboard information, classroom relationships, threat-related records, synchronization logs, activity logs, and administrative records.

The PostgreSQL database is accessed through the FastAPI backend and is not accessed directly by the Vue web portal or the Godot client.

## 3. Client/Server Relationship

Godot and the Vue.js Web Portal are both clients of the FastAPI backend.

The Web Portal does not function as a mandatory intermediary between the Godot game and FastAPI. Instead, both clients communicate with the backend according to their respective responsibilities.

Conceptually:

Godot Game Client
    |
    | API requests
    v
FastAPI Backend
    |
    v
PostgreSQL

Vue.js Web Portal
    |
    | API requests
    v
FastAPI Backend
    |
    v
PostgreSQL

For offline gameplay, the Godot client can operate independently using the local SQLite database.

The backend acts as the server-side security and processing boundary. Clients are not trusted to directly determine authorization, modify database records, or bypass backend validation.

## 4. Offline Architecture

CyberMorph follows an offline-first gameplay architecture.

When network connectivity is unavailable, the Godot client continues operating using locally persisted information in SQLite. Gameplay-related records are created and maintained locally rather than requiring immediate communication with the cloud backend.

The local database includes gameplay and player-related records such as:

- local_player
- local_sessions
- local_scores
- local_threat_index
- threat_attack_log
- local_map_baseline
- ai_state
- pending_sync_queue

The `ai_state` remains local because it represents derived internal AI information used by the game for adaptive behavior rather than primary cloud data.

## 5. Online Synchronization

When network connectivity is available, locally stored information can be synchronized with the cloud backend.

The synchronization architecture consists conceptually of:

Godot
    |
    v
SQLite
    |
    v
Pending Sync Queue
    |
    v
FastAPI Sync Endpoints
    |
    v
PostgreSQL

The planned synchronization API includes:

- `GET /sync/player-state`
- `POST /sync/session`
- `POST /sync/threat-index`
- `POST /sync/threat-events`

The backend plan specifies idempotent synchronization behavior because repeated submissions caused by unreliable mobile connectivity are expected. Client-generated UUIDs are used to prevent duplicate session and threat-event records during retries.

The exact synchronization trigger used by the final Godot implementation is not established in this document. The backend plan indicates that cloud state may be pulled on login/lobby load and that session and related threat-event data may be pushed when synchronization is triggered.

Implementation detail: exact synchronization trigger and client-side synchronization scheduling must be confirmed against the final Godot implementation.

## 6. User Roles

CyberMorph has three primary user roles.

### 6.1 Player

The Player is the primary game user.

Players can:

- Register and authenticate
- Play the cybersecurity simulation
- View and interact with the Threat Index
- Complete game sessions
- View leaderboard information
- Join an educator's classroom using a classroom code
- Synchronize eligible gameplay records with the cloud when authenticated and online

Player-specific backend access is enforced through player authentication dependencies.

### 6.2 Educator

The Educator uses the web portal to manage classroom-related functionality and monitor student progress.

Educator functionality includes:

- Registering for portal access
- Accessing educator profile information
- Generating classroom codes
- Viewing owned classroom codes
- Viewing enrolled students
- Monitoring classroom and student analytics
- Managing classroom codes

Educator registration is subject to the approval workflow defined by the backend. New educator accounts may initially be inactive and pending approval.

### 6.3 Admin

The Admin has system-level administrative access through the web portal.

Admin functionality includes:

- Managing users
- Reviewing educator approvals
- Managing classroom records
- Viewing system logs
- Viewing system statistics
- Restoring soft-deleted records where permitted

Admin endpoints require explicit admin authorization rather than relying only on general web-user authentication.

## 7. Classroom System

The classroom system provides a voluntary association between Players and Educators.

The conceptual relationship is:

Educator
    |
    | creates
    v
Classroom Code
    |
    | player joins using code
    v
Player-Classroom Association
    |
    v
Student Progress

Educators may manage multiple classroom codes, while a classroom code may have multiple enrolled Players.

The backend provides functionality for:

- Generating classroom codes
- Listing an educator's classroom codes
- Joining a classroom using a code
- Viewing students associated with a classroom
- Editing classroom metadata
- Activating/deactivating classroom codes
- Soft-deleting classroom codes

Classroom ownership and role authorization are enforced by the backend.

## 8. Data Flow

### 8.1 Online Web Portal Request

Vue Web Portal
    |
    | HTTP request
    v
FastAPI
    |
    | authenticate / authorize / validate
    v
PostgreSQL
    |
    | result
    v
FastAPI
    |
    | HTTP response
    v
Vue Web Portal

### 8.2 Online Godot Request

Godot
    |
    | HTTP request
    v
FastAPI
    |
    | authenticate / authorize / validate
    v
PostgreSQL
    |
    | result
    v
FastAPI
    |
    | HTTP response
    v
Godot

### 8.3 Offline Gameplay

Player
    |
    v
Godot
    |
    v
SQLite
    |
    v
Pending Sync Queue

No cloud request is required for the basic offline gameplay loop.

### 8.4 Offline-to-Online Synchronization

SQLite
    |
    v
Pending Sync Queue
    |
    | authenticated sync request
    v
FastAPI
    |
    | validation / authorization / idempotency
    v
PostgreSQL

### 8.5 Web Monitoring of Player Data

Godot
    |
    v
Local SQLite
    |
    v
Synchronization
    |
    v
FastAPI
    |
    v
PostgreSQL
    |
    v
FastAPI
    |
    v
Vue Web Portal

The Web Portal therefore retrieves persisted cloud information through the backend rather than receiving gameplay data directly from Godot.

## 9. Security Boundaries

The FastAPI backend is the primary server-side security boundary between clients and the database.

The backend is responsible for:

- Authentication
- Authorization
- Input validation
- Role enforcement
- Database access control
- Secure error handling
- Data integrity rules

The frontend and Godot client are not trusted sources of authorization decisions.

Vue route guards may prevent inappropriate navigation within the web application, but actual authorization must be enforced by FastAPI.

Similarly, the backend must validate and authorize data received from the Godot client rather than assuming that client-provided values are trustworthy.

The backend authentication design uses JWT-based authentication and bcrypt password hashing.

CORS configuration and security-sensitive configuration are intended to be environment-driven rather than hardcoded.

Secrets must not be committed to source control.

## 10. Cross-Repository Dependencies

CyberMorph consists of multiple collaborating repositories/components, including the Vue frontend, FastAPI backend, Godot client, and AI-related resources.

Changes affecting shared contracts must remain consistent across repositories.

Important shared contracts include:

- User roles
- Threat taxonomy
- Map ordering
- API request/response formats
- Synchronization payloads
- Player progression semantics

The backend plan identifies a current cross-repository map-order dependency that must be resolved before final synchronization integration. The backend and Godot client must agree on the progression meaning of `map_progress`.

## 11. Known / Unconfirmed Details

The following details should not be assumed by frontend agents until confirmed against the implemented backend or Godot client:

- Final production API base URL
- Exact response schema for every endpoint
- Exact JWT payload structure
- Exact token persistence mechanism on the frontend
- Exact synchronization trigger and scheduling behavior
- Final conflict-resolution behavior for all synchronization cases
- Final Godot authentication handoff mechanism
- Final CORS production origins
- Final API deployment configuration
- Final map order used by both Godot and FastAPI

When these details are required for implementation, the agent must inspect the current backend/Godot implementation or documented API contract rather than inventing them.