# VIGIA RoadIntelligence IDE - UI Requirements

## Product Vision

Transform VIGIA from a "Command Center" dashboard into a professional, high-density **RoadIntelligence IDE** — a monochrome, enterprise-grade tool for road infrastructure analysis that mirrors the sophistication of VS Code and GitHub's interface design.

## Core Principles

1. **Monochrome Minimalism**: Clean grey/white palette with 1px borders
2. **High Information Density**: Maximum data visibility without clutter
3. **IDE-First Layout**: Sidebar explorer, tabbed main stage, bottom console
4. **Professional Typography**: Inter for UI, JetBrains Mono for data
5. **Preserve Functionality**: Zero disruption to AWS/ONNX/Bedrock integration

---

## Functional Requirements

### FR-1: Layout Architecture

**FR-1.1**: The application SHALL use a three-panel IDE layout:
- Left sidebar (Explorer): 240px fixed width
- Center stage (Main): Flexible width, tabbed interface
- Bottom console: 200px collapsible height

**FR-1.2**: The layout SHALL be responsive with minimum viewport width of 1280px

**FR-1.3**: All panels SHALL have 1px solid borders (#CBD5E1)

### FR-2: Sidebar Explorer

**FR-2.1**: The sidebar SHALL display a nested folder structure:
```
📁 Sessions
  📁 2026-02-27
    📄 Session-001
    📄 Session-002
📁 Live Streams
  📹 Sentinel Eye (Active)
```

**FR-2.2**: The sidebar SHALL use thin-stroke icons (Lucide React or Heroicons)

**FR-2.3**: Folder expansion SHALL be indicated by chevron icons (right = collapsed, down = expanded)

**FR-2.4**: Active items SHALL have a #F5F5F5 background highlight

### FR-3: Tabbed Map Stage

**FR-3.1**: The main stage SHALL support multiple map tabs

**FR-3.2**: Each tab SHALL display:
- Tab label (e.g., "World Map", "Rourkela District")
- Close button (× icon)
- Active tab indicator (bottom border: 2px solid #000000)

**FR-3.3**: The map SHALL use Amazon Location Service with "Light Gray Canvas" style

**FR-3.4**: The map SHALL display hazard markers with monochrome styling:
- Verified hazards: Black circle with white center
- Unverified hazards: Grey circle with white center

**FR-3.5**: A breadcrumb bar SHALL display above the map:
```
World > India > Odisha > Rourkela
```

### FR-4: Bottom Console

**FR-4.1**: The console SHALL have three tabs:
- **Agent Traces**: Bedrock reasoning traces (monospaced)
- **DePIN Ledger**: Contribution log (tabular)
- **Terminal**: System logs

**FR-4.2**: The console SHALL be collapsible via a drag handle

**FR-4.3**: Agent Traces SHALL display:
- Timestamp (JetBrains Mono, 10px)
- Reasoning step (JetBrains Mono, 11px)
- Action taken (JetBrains Mono, 11px)

**FR-4.4**: DePIN Ledger SHALL display as a table:
| Timestamp | Contributor | Hazard Type | Location | Reward |
|-----------|-------------|-------------|----------|--------|

**FR-4.5**: Console text SHALL use JetBrains Mono font

### FR-5: Sentinel Eye (Docked Panel)

**FR-5.1**: The Sentinel Eye SHALL be a docked right-side panel (320px width)

**FR-5.2**: The panel SHALL display:
- Video feed (object-cover, 16:9 aspect ratio)
- Canvas overlay for bounding boxes
- HUD overlays (detection counter, live indicator)
- Telemetry log (bottom overlay)

**FR-5.3**: The panel SHALL be collapsible via a toggle button

**FR-5.4**: Bounding boxes SHALL use black stroke (#000000, 2px width)

**FR-5.5**: Detection labels SHALL use JetBrains Mono font

### FR-6: Typography Rules

**FR-6.1**: UI elements (buttons, labels, tabs) SHALL use Inter font

**FR-6.2**: Data elements (coordinates, timestamps, logs) SHALL use JetBrains Mono font

**FR-6.3**: Font sizes:
- Headers: 14px (Inter, 600 weight)
- Body: 12px (Inter, 400 weight)
- Data: 11px (JetBrains Mono, 400 weight)
- Small data: 10px (JetBrains Mono, 400 weight)

### FR-7: Color Palette

**FR-7.1**: Background colors:
- Primary: #FFFFFF
- Secondary: #F5F5F5
- Hover: #E5E7EB

**FR-7.2**: Border colors:
- Default: #CBD5E1 (1px solid)
- Active: #000000 (2px solid)

**FR-7.3**: Text colors:
- Primary: #000000
- Secondary: #6B7280
- Tertiary: #9CA3AF

**FR-7.4**: Accent colors (minimal use):
- Success: #10B981 (for detection indicators only)
- Danger: #EF4444 (for live scanning indicator only)

### FR-8: Interactions

**FR-8.1**: Hover states SHALL use #F5F5F5 background

**FR-8.2**: Active states SHALL use #E5E7EB background

**FR-8.3**: Transitions SHALL be 150ms ease-in-out

**FR-8.4**: Buttons SHALL have 1px solid borders with 4px border-radius

### FR-9: Preservation Requirements

**FR-9.1**: The refactor SHALL NOT modify:
- `hazard-detector.worker.ts` (ONNX inference logic)
- Lambda integration code
- Bedrock Agent API calls
- DynamoDB query logic

**FR-9.2**: The refactor SHALL preserve:
- Real-time hazard detection
- Bounding box visualization
- Telemetry batching and transmission
- Reasoning trace fetching
- Ledger entry polling

**FR-9.3**: All existing functionality SHALL remain operational after refactor

---

## Non-Functional Requirements

### NFR-1: Performance

**NFR-1.1**: UI rendering SHALL NOT impact ONNX inference performance (target: <100ms per frame)

**NFR-1.2**: Map rendering SHALL support 1000+ hazard markers without lag

**NFR-1.3**: Console log rendering SHALL use virtualization for >100 entries

### NFR-2: Accessibility

**NFR-2.1**: All interactive elements SHALL be keyboard navigable

**NFR-2.2**: Color contrast SHALL meet WCAG AA standards (4.5:1 for text)

**NFR-2.3**: Focus indicators SHALL be visible (2px solid #000000 outline)

### NFR-3: Maintainability

**NFR-3.1**: Component structure SHALL follow atomic design principles

**NFR-3.2**: Styling SHALL use Tailwind CSS utility classes

**NFR-3.3**: No inline styles SHALL be used (except dynamic canvas operations)

---

## Success Criteria

1. ✅ Layout matches VS Code IDE structure (sidebar + main + console)
2. ✅ All text uses correct fonts (Inter for UI, JetBrains Mono for data)
3. ✅ Color palette is strictly monochrome (grey/white/black)
4. ✅ All existing features work without regression
5. ✅ UI feels professional and enterprise-grade
6. ✅ Information density is maximized without clutter
7. ✅ Demo-ready for Amazon 10,000 AIdeas competition

---

## Out of Scope

- Dark mode toggle (monochrome light theme only)
- Mobile responsive design (desktop-first, 1280px minimum)
- User authentication/authorization
- Real-time collaboration features
- Custom map tile generation
