# Integration Plan: Innovation Features into Existing VIGIA Dashboard

## Overview

This document outlines how to properly integrate the 4 innovation features into the existing VIGIA dashboard structure, NOT as a separate page.

---

## Current Structure

```
VIGIA Dashboard (/)
├── Activity Bar (Left, 48px)
│   ├── Geo Explorer (existing)
│   ├── Detection (existing)
│   ├── Network (existing)
│   └── [NEW] Maintenance
├── Sidebar Panel (210px, varies by activity)
│   ├── Explorer Panel (when Geo Explorer active)
│   ├── Detection Panel (when Detection active)
│   ├── Network Panel (when Network active)
│   └── [NEW] Maintenance Panel
├── Main Stage (center)
│   └── Map View / Detection View / Network View
└── Console Panel (bottom, 220px)
    ├── Agent Traces Tab [ENHANCE]
    ├── DePIN Ledger Tab [ENHANCE]
    └── Console Tab
```

---

## Feature 1: Infrastructure "Diff" Tool

### Location: Geo Explorer Activity Group

### Implementation:

**1. Enhance SessionTree in Sidebar.tsx**
- Add drag-and-drop handlers to TreeNode components
- When user drags one session onto another, trigger diff computation
- Store diff state in a new Zustand store

**2. Add Diff Visualization to Map**
- Create `<DiffMarkersLayer>` component
- Render on main map when diff state exists
- RED markers: new hazards
- GREEN markers: fixed hazards
- ORANGE markers: worsened hazards

**3. Add Diff Legend**
- Show in top-left of map when diff active
- Display counts: "+12 new, -5 fixed, 3 worsened"
- "Clear Diff" and "Export Diff" buttons

**Files to Modify:**
```
packages/frontend/app/components/Sidebar.tsx
  - Add onDragStart, onDragOver, onDrop to TreeNode
  - Call computeDiff() when drop detected

packages/frontend/app/components/LiveMap.tsx
  - Import DiffMarkersLayer
  - Render when diffState exists

packages/frontend/stores/mapFileStore.ts
  - Already created, integrate into main app

packages/frontend/app/page.tsx
  - Add diffState to Dashboard component
  - Pass to LiveMap
```

**Key Code Changes:**

```typescript
// In Sidebar.tsx TreeNode for sessions
<TreeNode
  label={label}
  icon="session"
  draggable={true}
  onDragStart={(e) => {
    e.dataTransfer.setData('sessionId', session.sessionId);
  }}
  onDragOver={(e) => {
    e.preventDefault();
    e.currentTarget.style.background = 'rgba(59,130,246,0.2)';
  }}
  onDrop={async (e) => {
    e.preventDefault();
    const draggedSessionId = e.dataTransfer.getData('sessionId');
    if (draggedSessionId !== session.sessionId) {
      await computeDiff(draggedSessionId, session.sessionId);
    }
  }}
/>
```

---

## Feature 2: Scenario "Branching"

### Location: Geo Explorer Activity Group

### Implementation:

**1. Add Context Menu to Sessions**
- Right-click on session → Show context menu
- Option: "Create Branch"
- Creates `.scmap` file (scenario map)

**2. Visual Distinction for Branches**
- Branch files show with 🌿 icon
- Nested under parent session
- Dashed border in tree

**3. Branch Editing Mode**
- When `.scmap` file is active:
  - Show "Branch Mode" indicator
  - Allow toggling hazards on/off
  - Show "Recompute Routes" button
  - Display latency comparison widget

**Files to Modify:**
```
packages/frontend/app/components/Sidebar.tsx
  - Add context menu state
  - Add "Create Branch" option
  - Render branch files nested under parent

packages/frontend/app/components/LiveMap.tsx
  - Add branch editing mode
  - Show dashed borders for simulated hazards
  - Add "Recompute Routes" button overlay

packages/frontend/stores/mapFileStore.ts
  - Add createBranch() action
  - Add updateBranchChanges() action
```

**Key Code Changes:**

```typescript
// In Sidebar.tsx
const [contextMenu, setContextMenu] = useState<{x: number, y: number, session: any} | null>(null);

<TreeNode
  onContextMenu={(e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, session });
  }}
/>

{contextMenu && (
  <div style={{position: 'fixed', left: contextMenu.x, top: contextMenu.y, ...}}>
    <button onClick={() => createBranch(contextMenu.session)}>
      🌿 Create Branch
    </button>
  </div>
)}
```

---

## Feature 3: Explainable AI (ReAct Logs)

### Location: Console Panel → Agent Traces Tab

### Implementation:

**1. Enhance Existing Agent Traces Tab**
- Already exists in Console Panel
- Connect to SSE stream: `/api/agent-traces/stream`
- Display ReAct pattern: Thought → Action → Observation → Answer

**2. Format ReAct Logs**
- Use JetBrains Mono font
- Color coding:
  - Thought: italic gray
  - Action: bold blue
  - Observation: normal gray
  - Final Answer: bold green

**Files to Modify:**
```
packages/frontend/app/components/ReasoningTraceViewer.tsx
  - Enhance to show ReAct pattern
  - Connect to SSE stream
  - Add search/filter functionality

packages/frontend/stores/agentTraceStore.ts
  - Already created, integrate into ReasoningTraceViewer
```

**Key Code Changes:**

```typescript
// In ReasoningTraceViewer.tsx
useEffect(() => {
  const eventSource = new EventSource(
    'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod/agent-traces/stream'
  );
  
  eventSource.onmessage = (event) => {
    const trace = JSON.parse(event.data);
    appendTrace(trace);
  };
  
  return () => eventSource.close();
}, []);
```

---

## Feature 4: Economic Layer (Maintenance & ROI)

### Location: New "Maintenance" Activity Group + DePIN Ledger Tab

### Implementation:

**1. Add Maintenance Activity Button**
- Add to Activity Bar (already done above)
- Icon: Wrench
- Opens Maintenance Panel

**2. Create Maintenance Panel**
- Shows when Maintenance activity is active
- Contains:
  - Maintenance report form
  - Maintenance queue list
  - Status badges (PENDING, IN_PROGRESS, COMPLETED)

**3. Hazard Click Integration**
- When user clicks hazard marker on map:
  - Check if hazard is unfixed
  - Show popup: "Report for Maintenance?"
  - If yes, switch to Maintenance activity
  - Pre-fill form with hazard details

**4. Enhance DePIN Ledger Tab**
- Add ROI Widget at top
- Show:
  - Total hazards detected
  - Estimated repair costs
  - Prevented damage costs
  - ROI multiplier
  - Breakdown by hazard type

**Files to Modify:**
```
packages/frontend/app/components/Sidebar.tsx
  - Add Maintenance activity button (done)
  - Add Maintenance panel rendering

packages/frontend/app/components/LiveMap.tsx
  - Add click handler to hazard markers
  - Show "Report for Maintenance" popup

packages/frontend/app/components/LedgerTicker.tsx
  - Enhance to show ROI widget
  - Connect to economic metrics API

packages/frontend/stores/economicStore.ts
  - Already created, integrate into components
```

**Key Code Changes:**

```typescript
// In Sidebar.tsx - Add Maintenance Panel
{activeActivity === 'maintenance' && (
  <div style={{width, display: 'flex', flexDirection: 'column', ...}}>
    <div style={{...}}>MAINTENANCE</div>
    <MaintenancePanel />
  </div>
)}

// In LiveMap.tsx - Hazard click handler
marker.on('click', () => {
  if (hazard.status === 'verified' && !hazard.fixed) {
    showMaintenancePrompt(hazard);
  }
});

// In LedgerTicker.tsx - Add ROI Widget
<ROIWidget sessionId={currentSessionId} />
```

---

## Implementation Priority

### Phase 1: Core Infrastructure (1-2 hours)
1. Add Maintenance activity button ✅ (done)
2. Create Maintenance panel component
3. Integrate mapFileStore into main app
4. Integrate economicStore into main app

### Phase 2: Diff Tool (2-3 hours)
1. Add drag-and-drop to SessionTree
2. Create DiffMarkersLayer component
3. Add diff legend overlay
4. Test with sample files

### Phase 3: Scenario Branching (2-3 hours)
1. Add context menu to sessions
2. Implement branch creation
3. Add branch editing mode
4. Integrate routing API

### Phase 4: ReAct Logs (1-2 hours)
1. Enhance ReasoningTraceViewer
2. Connect to SSE stream
3. Format ReAct pattern display
4. Add search/filter

### Phase 5: Economic Layer (2-3 hours)
1. Create Maintenance panel UI
2. Add hazard click handler
3. Enhance DePIN Ledger with ROI widget
4. Connect to economic APIs

### Phase 6: Testing & Polish (2-3 hours)
1. End-to-end testing
2. UI polish
3. Performance optimization
4. Documentation

**Total Estimated Time: 10-16 hours**

---

## Key Principles

1. **No Separate Page**: All features integrated into main dashboard
2. **Activity-Based**: Features grouped by activity (Explorer, Maintenance)
3. **Local-First**: Diff and branching use IndexedDB, not server
4. **Real-Time**: ReAct logs stream via SSE
5. **Contextual**: Maintenance triggered by hazard clicks

---

## Next Steps

1. Review this plan
2. Implement Phase 1 (core infrastructure)
3. Test each phase before moving to next
4. Update this document as implementation progresses

---

**Status**: Plan Complete - Ready for Implementation
