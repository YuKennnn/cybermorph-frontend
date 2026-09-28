# CyberMorph Frontend Architecture Decisions

## ADR-001: Vue 3 for the Web Portal

Status: Accepted

Decision:
Use Vue 3 as the frontend framework for the CyberMorph Web Portal.

Reason:
The project already uses Vue 3 and requires a component-based web interface for Player, Educator, and Admin functionality.

## ADR-002: Vue Router for Client-Side Navigation

Status: Accepted

Decision:
Use Vue Router to manage navigation and client-side route protection.

Reason:
The Web Portal contains role-specific views and requires controlled navigation between public and protected routes.

Security note:
Vue Router guards are not considered the authoritative security boundary. Backend authorization remains mandatory.

## ADR-003: Pinia for Authentication State

Status: Accepted

Decision:
Use Pinia to manage application-wide authentication state.

Reason:
Authentication state and the current user's role may be required by multiple parts of the frontend, including views, router guards, and application logic.

## ADR-004: Dedicated API Layer

Status: Accepted

Decision:
Separate backend API communication from Vue components.

Reason:
Centralizing API communication improves maintainability, reduces duplicated request logic, and keeps presentation components focused on UI behavior.

## ADR-005: Backend as Security Boundary

Status: Accepted

Decision:
Treat FastAPI as the authoritative authentication and authorization boundary.

Reason:
Frontend state can be manipulated by users and therefore cannot provide trustworthy security enforcement.

## ADR-006: Do Not Invent API Contracts

Status: Accepted

Decision:
The frontend must not assume undocumented endpoints, fields, or authentication behavior.

Reason:
The backend plan and actual FastAPI implementation may evolve independently from the frontend. The frontend must implement against confirmed API behavior rather than guessed contracts.

## ADR-007: Offline-First Game, Online Web Portal

Status: Accepted

Decision:
Treat the Godot game and Vue Web Portal as separate clients of the FastAPI backend.

Reason:
The Godot game must support offline operation through local SQLite, while the Web Portal requires online access to cloud-persisted information.

## ADR-008: Documentation as Persistent Project Context

Status: Accepted

Decision:
Use AGENTS.md and focused documentation files as persistent project context for AI-assisted development.

Reason:
Persistent project context reduces repeated explanations, keeps architectural constraints visible, and allows AI agents to work on focused tasks without requiring the entire project history in every prompt.