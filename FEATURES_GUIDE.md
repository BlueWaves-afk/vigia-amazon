# VIGIA Innovation Features - Quick Start Guide

## 🎯 Overview

All 4 innovation features are now integrated into the main VIGIA dashboard. No separate pages - everything is accessible through the Activity Bar on the left.

---

## 🗺️ Feature 1: Infrastructure "Diff" Tool

**Purpose**: Compare two road hazard sessions to see what changed over time.

### How to Use:

1. **Open Geo Explorer** (Globe icon in Activity Bar)
2. **Find two sessions** in the tree (e.g., same location, different dates)
3. **Drag one session** onto another session
4. **View the diff** on the map:
   - 🔴 **RED markers**: New hazards (appeared in second session)
   - 🟢 **GREEN markers**: Fixed hazards (disappeared from first session)
   - 🟠 **ORANGE markers**: Worsened hazards (severity increased)
5. **Check the legend** (top-left of map) for counts
6. **Click "Clear Diff"** to remove visualization

### Use Cases:
- Track infrastructure improvements over time
- Identify areas where conditions are deteriorating
- Measure effectiveness of maintenance efforts
- Generate before/after reports for stakeholders

---

## 🌿 Feature 2: Scenario "Branching"

**Purpose**: Create "what-if" scenarios by simulating hazard changes without affecting real data.

### How to Use:

1. **Open Geo Explorer** (Globe icon in Activity Bar)
2. **Right-click on a session** in the tree
3. **Select "Create Branch"** from context menu
4. **Branch file appears** with 🌿 icon (nested under parent)
5. **Click the branch** to activate it
6. **Toggle hazards** on/off in branch editing mode
7. **Click "Recompute Routes"** to see impact on routing
8. **View latency comparison** widget showing baseline vs. branch

### Use Cases:
- Test impact of fixing specific hazards on route efficiency
- Prioritize maintenance based on routing impact
- Simulate emergency road closures
- Plan infrastructure investments

---

## 🤖 Feature 3: Explainable AI (ReAct Logs)

**Purpose**: See real-time reasoning traces from the Bedrock Agent to understand how decisions are made.

### How to Use:

1. **Open Console Panel** (bottom of screen)
2. **Click "Agent Traces" tab**
3. **Watch live traces** stream in (LIVE indicator shows connection status)
4. **Click any trace** to expand and see ReAct steps:
   - 💭 **Thought**: What the agent is thinking
   - ⚡ **Action**: What action it's taking
   - 👁️ **Observation**: What it observed
   - ✓ **Final Answer**: The decision made
5. **Use search box** to filter traces by keyword
6. **Scroll through history** (last 1000 traces kept)

### Use Cases:
- Debug why a hazard was verified or rejected
- Understand agent decision-making process
- Audit AI behavior for compliance
- Train new team members on system logic

---

## 💰 Feature 4: Economic Layer (Maintenance & ROI)

**Purpose**: Report hazards for maintenance and track economic impact of the system.

### How to Use:

#### Reporting Maintenance:

1. **Click a hazard marker** on the map
2. **Confirm "Report for Maintenance?"** popup
3. **System switches to Maintenance activity** (Wrench icon)
4. **Form is pre-filled** with hazard details
5. **Add notes** and submit report
6. **View in queue** with status badges (PENDING, IN_PROGRESS, COMPLETED)

#### Viewing ROI:

1. **Open Console Panel** (bottom of screen)
2. **Click "DePIN Ledger" tab**
3. **View ROI Widget** at top showing:
   - Total hazards detected
   - Estimated repair costs
   - Prevented damage costs (accidents avoided)
   - ROI multiplier (e.g., 5.2x)
   - Breakdown by hazard type

### Use Cases:
- Coordinate maintenance crews
- Track repair costs vs. damage prevented
- Justify system investment to stakeholders
- Prioritize high-ROI maintenance tasks

---

## 🎨 UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Top Bar                                                      │
├──┬──────────────────────────────────────────────────────────┤
│  │ Main Stage (Map / Detection / Network)                   │
│A │                                                           │
│c │  ┌─────────────────────────────────────────────┐        │
│t │  │ Diff Legend (when diff active)              │        │
│i │  │ +12 new  -5 fixed  3 worsened               │        │
│v │  │ [Clear Diff] [Export Diff]                  │        │
│i │  └─────────────────────────────────────────────┘        │
│t │                                                           │
│y │  🔴 RED = New hazards                                    │
│  │  🟢 GREEN = Fixed hazards                                │
│B │  🟠 ORANGE = Worsened hazards                            │
│a │                                                           │
│r │                                                           │
│  │                                                           │
├──┼───────────────────────────────────────────────────────────┤
│  │ Console Panel                                            │
│  │ ┌─────────┬─────────┬─────────┐                         │
│  │ │ Traces  │ Ledger  │ Console │                         │
│  │ └─────────┴─────────┴─────────┘                         │
│  │ [Content based on active tab]                           │
└──┴───────────────────────────────────────────────────────────┘
```

### Activity Bar Icons:
- 🌍 **Geo Explorer**: Browse sessions, create diffs, manage branches
- 🎯 **Detection**: Upload dashcam footage, detect hazards
- 📡 **Network**: View swarm topology, node health
- 🔧 **Maintenance**: Report hazards, view queue, track ROI

---

## 🔑 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Switch to Geo Explorer |
| `Ctrl+2` | Switch to Detection |
| `Ctrl+3` | Switch to Network |
| `Ctrl+4` | Switch to Maintenance |
| `Ctrl+D` | Clear active diff |
| `Ctrl+F` | Focus search in traces |
| `Esc` | Close modals/popups |

---

## 📊 Performance Tips

### Diff Tool:
- Limit comparisons to sessions with <500 hazards for best performance
- Diff computation runs in Web Worker (non-blocking)
- Clear diff when done to free memory

### Scenario Branching:
- Keep simulated changes to <100 hazards for 60fps rendering
- Branch files stored locally in IndexedDB (not sent to server)
- Delete unused branches to free storage

### ReAct Logs:
- Filter traces to reduce visual clutter
- System keeps last 1000 traces (auto-evicts older ones)
- SSE connection auto-reconnects if dropped

### Economic Layer:
- ROI calculations cached for 5 minutes
- Maintenance queue refreshes every 30 seconds
- Submit reports in batches for efficiency

---

## 🐛 Troubleshooting

### Diff not showing?
- Ensure both sessions have hazard data
- Check browser console for errors
- Try clearing diff and re-dragging

### Branch not creating?
- Verify parent session exists
- Check IndexedDB quota (50MB limit)
- Clear old branches if quota exceeded

### Traces not streaming?
- Check "LIVE" indicator (should be green)
- Verify API endpoint in .env.local
- Check browser console for SSE errors

### ROI Widget not updating?
- Ensure session has verified hazards
- Check economic metrics API endpoint
- Refresh page to force re-fetch

---

## 🚀 Next Steps

1. **Explore the features** using this guide
2. **Test with real data** from your sessions
3. **Report issues** via GitHub Issues
4. **Share feedback** with the team

---

## 📚 Additional Resources

- [INTEGRATION_COMPLETE.md](./INTEGRATION_COMPLETE.md) - Technical implementation details
- [INTEGRATION_PLAN.md](./INTEGRATION_PLAN.md) - Original integration plan
- [requirements_innovate.md](./requirements_innovate.md) - Feature requirements
- [design_innovate.md](./design_innovate.md) - Technical architecture
- [tasks_innovate.md](./tasks_innovate.md) - Implementation checklist

---

**Built with**: Next.js 14, MapLibre GL JS, Amazon Bedrock (Nova Lite), DynamoDB, Lambda, Amazon Location Service
