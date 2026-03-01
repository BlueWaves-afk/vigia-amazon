# VIGIA Innovation Features - Requirements Specification

**Document Version**: 1.0  
**Last Updated**: 2026-03-01  
**Status**: Draft - Awaiting Implementation

---

## Epic: Transform VIGIA into Decision-Ready Infrastructure Intelligence Platform

**Epic Goal**: Evolve VIGIA from a real-time hazard detection system into a comprehensive infrastructure intelligence platform that enables temporal auditing, scenario simulation, explainable AI transparency, and economic impact quantification.

**Business Value**: 
- Enable city engineers to track infrastructure decay cycles
- Provide "what-if" routing simulations for disaster preparedness
- Build public trust through AI transparency
- Demonstrate ROI to municipalities and insurers

**Target Users**: City engineers, transportation planners, insurance actuaries, public works departments

---

## Feature 1: Infrastructure "Diff" Tool (Temporal Auditing)

### User Story 1.1: Compare Road Sessions
**As a** city engineer  
**I want to** drag-and-drop two session files to compare infrastructure state over time  
**So that** I can visualize decay patterns and verify repair completion

**Acceptance Criteria**:
- AC1.1.1: User can drag `Session-YYYY-MM-DD.map` file onto another `.map` file in the Map File System explorer
- AC1.1.2: System renders diff visualization within 2 seconds for files containing up to 500 hazards each
- AC1.1.3: New hazards (present in File B, absent in File A) display as RED markers
- AC1.1.4: Fixed hazards (present in File A, absent in File B) display as GREEN markers
- AC1.1.5: Deteriorating hazards (severity increased between sessions) display as ORANGE markers
- AC1.1.6: Diff state remains local-only unless user explicitly clicks "Save Diff Report"
- AC1.1.7: Diff view includes legend showing hazard count deltas (e.g., "+12 new, -5 fixed, 3 worsened")

### User Story 1.2: Export Temporal Audit Report
**As a** public works director  
**I want to** export diff analysis as a shareable report  
**So that** I can present infrastructure trends to city council

**Acceptance Criteria**:
- AC1.2.1: "Export Diff" button generates JSON report with hazard deltas
- AC1.2.2: Report includes geohash coordinates, timestamps, severity changes
- AC1.2.3: Optional PDF export with embedded map snapshot (stretch goal)

### Functional Requirements

**FR-DIFF-001**: The system SHALL parse `.map` files containing JSON arrays of hazard objects with fields: `{id, geohash, type, severity, timestamp, signature}`

**FR-DIFF-002**: The system SHALL compute set differences using hazard `id` as the primary key

**FR-DIFF-003**: The system SHALL detect severity changes by comparing `severity` field values (1-5 scale)

**FR-DIFF-004**: The system SHALL render diff results on MapLibre GL JS using three distinct marker styles

**FR-DIFF-005**: The system SHALL maintain diff state in browser memory without persisting to DynamoDB unless user triggers "Save"

### Non-Functional Requirements

**NFR-DIFF-001**: Diff computation SHALL complete in <2s for files up to 1MB each (≈500 hazards)

**NFR-DIFF-002**: UI SHALL remain responsive during diff rendering (no main thread blocking >16ms)

**NFR-DIFF-003**: Memory usage SHALL not exceed 50MB for diff operation

**NFR-DIFF-004**: Diff visualization SHALL use monochrome palette (#EF4444 red, #10B981 green, #F59E0B orange)

---

## Feature 2: Scenario "Branching" (What-If Routing)

### User Story 2.1: Create Simulation Branch
**As a** transportation planner  
**I want to** right-click a `.map` file and select "Create Branch"  
**So that** I can simulate infrastructure failures without corrupting forensic data

**Acceptance Criteria**:
- AC2.1.1: Right-click context menu on `.map` files includes "Create Branch" option
- AC2.1.2: System creates new `.scmap` file with naming convention `Session-YYYY-MM-DD-branch-N.scmap`
- AC2.1.3: `.scmap` file inherits all hazards from parent `.map` file
- AC2.1.4: Branch file displays with distinct icon (branching symbol) in file explorer
- AC2.1.5: Branch creation completes in <500ms

### User Story 2.2: Simulate Infrastructure Changes
**As a** disaster preparedness coordinator  
**I want to** toggle off infrastructure elements (bridges, roads) in a branch  
**So that** I can model flood or earthquake scenarios

**Acceptance Criteria**:
- AC2.2.1: User can click hazards in `.scmap` view to toggle "simulated closure" state
- AC2.2.2: User can manually add simulated hazards via map click + form
- AC2.2.3: Simulated changes display with dashed borders to distinguish from real data
- AC2.2.4: Changes persist only in `.scmap` file, never in parent `.map`

### User Story 2.3: Recompute Routes for Branch
**As a** city traffic engineer  
**I want to** trigger route recompilation for a branch scenario  
**So that** I can quantify latency impact of infrastructure failures

**Acceptance Criteria**:
- AC2.3.1: "Recompute Routes" button visible when `.scmap` file is active
- AC2.3.2: System invokes Zone 3 Routing Agent with branch-specific hazard set
- AC2.3.3: Agent returns updated route latencies within 10 seconds
- AC2.3.4: UI displays side-by-side comparison: "Baseline: 12min avg → Branch: 18min avg (+50%)"
- AC2.3.5: Route recomputation uses cached Bedrock responses when possible to minimize cost

### Functional Requirements

**FR-BRANCH-001**: The system SHALL support `.scmap` file format with schema: `{parentMapId, branchId, simulatedHazards[], disabledInfrastructure[], timestamp}`

**FR-BRANCH-002**: The system SHALL render `.scmap` files with visual distinction (dashed borders, branch icon)

**FR-BRANCH-003**: The system SHALL invoke Lambda Orchestrator with `branchMode: true` flag to trigger scenario-specific routing

**FR-BRANCH-004**: The system SHALL cache Bedrock Agent responses per branch to avoid redundant API calls

**FR-BRANCH-005**: The system SHALL display latency delta calculations in the UI console panel

### Non-Functional Requirements

**NFR-BRANCH-001**: Branch creation SHALL not block UI (async operation)

**NFR-BRANCH-002**: Route recomputation SHALL cost <$0.10 per invocation (Bedrock Nova Lite)

**NFR-BRANCH-003**: Branch files SHALL be stored in browser IndexedDB with 50MB quota limit

**NFR-BRANCH-004**: System SHALL support up to 10 concurrent branches per session

---

## Feature 3: Explainable AI (Live ReAct Logs)

### User Story 3.1: View Agent Reasoning
**As a** system auditor  
**I want to** see the Bedrock Agent's internal reasoning process in real-time  
**So that** I can verify the system is making trustworthy decisions

**Acceptance Criteria**:
- AC3.1.1: "Agent Traces" tab displays live ReAct logs as telemetry is processed
- AC3.1.2: Each log entry shows: Thought → Action → Observation → Final Answer
- AC3.1.3: Logs auto-scroll to latest entry but allow manual scroll-lock
- AC3.1.4: Logs use JetBrains Mono font for readability
- AC3.1.5: Logs include timestamps (HH:MM:SS.mmm format)

### User Story 3.2: Filter and Search Traces
**As a** developer debugging the system  
**I want to** filter traces by geohash or contributor ID  
**So that** I can isolate specific verification flows

**Acceptance Criteria**:
- AC3.2.1: Search bar above trace log accepts geohash or contributor ID
- AC3.2.2: Filtered results highlight matching terms
- AC3.2.3: "Clear Filter" button restores full log view

### Functional Requirements

**FR-REACT-001**: The system SHALL stream Bedrock Agent traces via WebSocket or Server-Sent Events (SSE)

**FR-REACT-002**: The system SHALL parse ReAct pattern from Bedrock response JSON: `{thought, action, observation, answer}`

**FR-REACT-003**: The system SHALL store traces in DynamoDB `AgentTraces` table with TTL of 7 days

**FR-REACT-004**: The system SHALL render traces in the existing "Agent Traces" tab with syntax highlighting

**FR-REACT-005**: The system SHALL support client-side filtering without re-fetching from DynamoDB

### Non-Functional Requirements

**NFR-REACT-001**: Trace streaming SHALL have <500ms latency from Bedrock response to UI render

**NFR-REACT-002**: Trace log SHALL support up to 1000 entries in browser memory before pagination

**NFR-REACT-003**: Trace rendering SHALL not block main thread (use virtual scrolling)

**NFR-REACT-004**: Bedrock Agent invocation SHALL include `enableTrace: true` flag (no additional cost)

---

## Feature 4: Maintenance "Bounties" & Economic Layer

### User Story 4.1: Report Hazard for Maintenance
**As a** concerned citizen  
**I want to** click an unfixed pothole and submit a maintenance report  
**So that** the city can prioritize repairs

**Acceptance Criteria**:
- AC4.1.1: Clicking hazard marker shows popup with "Report for Maintenance" button
- AC4.1.2: Button opens new "Maintenance" activity group with pre-filled hazard details
- AC4.1.3: User can add optional notes (max 500 chars)
- AC4.1.4: Submission creates entry in DynamoDB `MaintenanceQueue` table
- AC4.1.5: Confirmation message displays estimated repair cost

### User Story 4.2: View Economic Impact Dashboard
**As a** city budget analyst  
**I want to** see ROI calculations for early hazard detection  
**So that** I can justify VIGIA funding

**Acceptance Criteria**:
- AC4.2.1: "DePIN Ledger" tab includes "City Health ROI" widget
- AC4.2.2: Widget displays: Total hazards detected, Estimated repair costs, Prevented damage costs
- AC4.2.3: Calculations update in real-time as new hazards are verified
- AC4.2.4: Widget shows 7-day rolling average

### User Story 4.3: Calculate Repair Cost Estimates
**As a** public works manager  
**I want to** see auto-calculated repair costs per hazard type  
**So that** I can budget maintenance schedules

**Acceptance Criteria**:
- AC4.3.1: System assigns cost estimates: Pothole ($150-$500), Debris ($50-$200), Flooding ($1000-$5000)
- AC4.3.2: Cost ranges adjust based on severity (1-5 scale)
- AC4.3.3: Costs display in hazard detail panel

### Functional Requirements

**FR-ECON-001**: The system SHALL create `MaintenanceQueue` DynamoDB table with schema: `{hazardId, geohash, type, severity, reportedBy, timestamp, estimatedCost, status}`

**FR-ECON-002**: The system SHALL calculate repair costs using formula: `baseCost[type] * severityMultiplier`

**FR-ECON-003**: The system SHALL calculate prevented damage using industry averages: Pothole vehicle damage = $300/incident

**FR-ECON-004**: The system SHALL aggregate ROI metrics in "DePIN Ledger" tab

**FR-ECON-005**: The system SHALL support "Maintenance" activity group with dedicated UI panel

### Non-Functional Requirements

**NFR-ECON-001**: ROI calculations SHALL update within 1 second of new hazard verification

**NFR-ECON-002**: Cost estimates SHALL be configurable via JSON config file (no hardcoding)

**NFR-ECON-003**: Maintenance queue SHALL support pagination for >100 entries

**NFR-ECON-004**: Economic dashboard SHALL render without blocking map interactions

---

## Cross-Feature Requirements

### Data Persistence

**CFR-DATA-001**: All local-first operations (diff, branching) SHALL use browser IndexedDB with 50MB quota

**CFR-DATA-002**: Server persistence (maintenance reports, traces) SHALL use DynamoDB with on-demand billing

**CFR-DATA-003**: File operations SHALL support undo/redo stack (max 20 operations)

### UI/UX Consistency

**CFR-UI-001**: All new features SHALL adhere to monochrome design system (#FFFFFF, #F5F5F5, #CBD5E1)

**CFR-UI-002**: All data displays SHALL use JetBrains Mono font

**CFR-UI-003**: All activity groups SHALL follow VS Code IDE layout pattern

### Performance

**CFR-PERF-001**: No single operation SHALL block main thread for >16ms

**CFR-PERF-002**: Total bundle size increase SHALL not exceed 200KB (gzipped)

**CFR-PERF-003**: Bedrock API calls SHALL be debounced to prevent cost overruns

### Security

**CFR-SEC-001**: Branch files SHALL inherit signature validation from parent `.map` files

**CFR-SEC-002**: Maintenance reports SHALL require ECDSA signature from authenticated users

**CFR-SEC-003**: Economic calculations SHALL be read-only (no user manipulation)

---

## Success Metrics

1. **Temporal Auditing**: 80% of city engineers can successfully compare two sessions within 5 minutes (usability test)
2. **Scenario Branching**: Route recomputation completes in <10s for 95% of branches
3. **Explainable AI**: 90% of traces render within 500ms of Bedrock response
4. **Economic Layer**: ROI widget displays accurate calculations for 100% of verified hazards

---

## Out of Scope (Phase 2)

- Multi-user collaboration on branch files
- Real-time sync of maintenance queue across devices
- Integration with city ticketing systems (e.g., 311 APIs)
- Machine learning for cost prediction refinement
- Mobile app versions of diff/branch tools
