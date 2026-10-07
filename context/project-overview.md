# MyIMS (Imergency Management System)

## Overview

MyIMS is a multi-tenant emergency response platform for local government units
(LGUs) and emergency service organizations. It connects platform operators,
tenant administrators, command-center staff, field responders, and public
reporters around one incident workflow: receive a request, create an incident,
dispatch a responder, monitor progress, and close the incident with its timeline
and audit history retained.

This is new development with no existing system. Delivery begins with a fresh
runtime and database, followed by initial provisioning and operational launch.



## Goals

1. Complete the emergency-response journey from staff intake through responder
   assignment, acceptance, progress, location sharing, and incident closure,
   with a retained timeline and actor-attributed audit.
2. Enable platform operators to configure Asterisk before completing voice-enabled
   tenant onboarding, and enable tenant administrators to manage staff and assign
   only verified extensions owned by their organization.
3. Enforce tenant ownership and role permissions throughout every supported
   workflow, with separate platform and tenant identities and no cross-tenant
   access in acceptance and concurrency checks.
4. Keep operations consistent across multiple backend replicas: shared sessions,
   cross-replica updates, and recovery after reconnect or replica interruption
   must pass the first-release acceptance checks.
5. Deliver maintainable, runnable user journeys incrementally, each with
   automated acceptance checks and updated documentation.

## Core User Flow

Operators can create a draft tenant and its first administrator before PBX
configuration. This early registry step creates no usable credentials or ordinary
staff access. Credential setup follows the approved credential lifecycle;
activation remains a separate readiness-checked action. The flow below describes
completed onboarding and operational use.

1. A platform operator signs in to the separate platform console, configures an
   Asterisk node, provisions extensions and routes, and validates, applies, and
   verifies the configuration.
2. The operator creates a tenant with a stable tenant code and initial
   administrator, allocates existing extensions, and verifies tenant routing.
   A tenant explicitly configured without voice can activate without PBX
   assignments; a voice-enabled tenant must meet telephony readiness checks.
3. The tenant administrator sets credentials, signs in with tenant code,
   username, and password, creates staff and responders, configures incident
   categories, and assigns verified, unassigned tenant extensions to staff.
4. A call taker answers an emergency call on a softphone or hard phone and
   creates a tenant-owned incident with reporter details, category, priority,
   and location. The incident entry's phone field is automatically populated
   with the caller's number. If the caller's location is unavailable, the
   longitude and latitude fields are populated with the configured default
   location coordinates. During the conversation, the call taker uses the
   caller's descriptions to search the map and identify the caller's location.
   Double-clicking that location on the map populates the incident entry's
   longitude and latitude fields with the selected coordinates, replacing any
   default coordinates. Intake drafts protect unfinished work.
5. A dispatcher selects an active responder and creates an assignment.
6. The responder receives the assignment in the mobile app, accepts it, updates
   its progress, shares foreground location, and completes the assignment.
7. Command-center staff monitor the incident, assignment, and responder location
   through synchronized operational queues and maps.
8. Authorized staff close the incident. Its timeline and audit retain the
   operational history and identify who made each sensitive change.
9. Public web, mobile, SMS, and voice entry points feed this same canonical
incident workflow.



## Features

### Platform and Asterisk Administration

- Separate platform console and tenantless operator sign-in.
- PBX nodes, extension inventory, SIP/WebRTC profiles, ring groups, dial plans,
  trunks, gateways, and DID management, with health and registration visibility.
- Configuration diff review, validation, apply progress, verification, and
  recovery to a known-good revision. Saving a form does not imply a live change.
- Tenant list, creation wizard, detail/edit screens, initial administrator setup,
  service area, and draft/active/suspended/retired lifecycle management.
- Non-overlapping tenant extension allocations, inbound routes, approved outbound
  permissions, and explicit telephony readiness.

### Tenant Administration and Access

- Tenant-code/username/password staff sign-in; usernames are unique within each
  tenant, and platform authority remains separate from staff authority.
- Staff, role, responder, and incident-category management, credential setup and
  reset, and audited extension assignment, unassignment, and reassignment.
- Tenant administrators select existing, verified tenant extensions and permitted
  ring-group/route options; shared PBX infrastructure remains platform-managed.
- Shared sessions with expiry and revocation across replicas. Account, role,
  credential, and tenant-status changes affect authorization across the system.

### Command Center and Responder Operations

- Incident intake drafts, reporter details, categories, priorities, locations,
  create/edit/detail/close actions, timeline, and audit.
- Responder profiles, availability, dispatch, and assignment lifecycle tracking.
- Responder mobile assignment receipt, acceptance, progress, completion, and
  foreground location sharing.
- Tenant-scoped realtime queues and maps showing incidents and responders,
  explicit location correction, and canonical state reload after reconnect.

### Operational Reliability and Later Extensions

- Multiple HTTP replicas, shared sessions, cross-replica realtime delivery,
  durable retryable jobs, health visibility, and tested replica recovery.
- Public web/mobile intake, attachments, audit review and
  recovery tools, browser calling, SMS, public voice, dashboards, reports,
  exports, retention, and initial provisioning and operational launch tooling.
- Public entry points resolve tenant ownership from deployment-controlled
  mappings; all accepted channels create or enrich the same incident model.


## Success Criteria

1. A fresh clone starts the database and backend, applies the baseline schema,
   runs the required checks, and displays health through the documented workflow.
2. Tenant-qualified staff identities work correctly: the same username can sign
   in under two different tenant codes, duplicates within one tenant are rejected,
   and platform and staff sessions cannot access each other's authority plane.
3. A platform operator configures extensions, ring groups, dial plans, and trunks
   through the browser, verifies an applied revision, and recovers from a failed
   apply. Unknown or ambiguous call sources fail safely.
4. An operator provisions two tenants on one PBX with non-overlapping extensions
   and separate inbound routing. Verified fixture calls preserve tenant ownership;
   duplicate staff assignments and premature voice readiness are rejected.
5. A call taker creates, refreshes, edits, and closes an incident without losing a
   meaningful draft. A dispatcher assigns an active responder who receives,
   accepts, progresses, and completes the assignment in the mobile app, with the
   canonical result visible in the command center.
6. Two staff sessions and one responder session on different replicas converge
   after incident, assignment, status, and location changes. Reconnect after a
   replica or broker interruption restores canonical state without cross-tenant
   delivery.
7. A session created on one replica works on another; logout, password reset,
   role changes, and tenant suspension take effect across replicas. Session-store
   failure denies session-dependent operations, and stopping one HTTP replica
   leaves the other serving traffic through the load balancer.
8. The retained timeline and audit explain the complete first-release journey,
   including actors and sensitive changes. Each delivered milestone has runnable
   acceptance checks and updated user/operator documentation.
9. Before operational rollout, the system meets agreed capacity, latency,
   accessibility, security, backup, and recovery checks. Targets must be defined
   and measured rather than inferred from the proposed architecture.
10. Initial provisioning verifies tenant ownership, referential integrity,
    critical read models, routing, and actor-attributed audit, and completes
    operational smoke checks, backup/restore, and deployment rollback rehearsals
    before the new system opens for operational use.
