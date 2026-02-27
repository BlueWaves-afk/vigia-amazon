# VIGIA RoadIntelligence IDE - Implementation Backlog

## Phase 1: Layout Skeleton

### TASK-UI-1.1: Create IDE Layout Container
- [x] Create `IDELayout.tsx` component with three-panel structure
- [x] Implement fixed sidebar (260px), flexible main stage, collapsible console (200px)
- [x] Add 1px solid borders (#CBD5E1) between panels
- [x] Ensure minimum viewport width (1280px)
- [x] Test responsive behavior

**Dependencies**: None  
**Estimated Time**: 30 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-1.2: Update Tailwind Config
- [x] Add custom color palette (ide-bg, ide-panel, ide-border, etc.)
- [x] Add font families (Inter, JetBrains Mono)
- [x] Add custom spacing values (4px base unit)
- [x] Test utility classes in browser

**Dependencies**: None  
**Estimated Time**: 15 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-1.3: Update globals.css
- [x] Import Inter and JetBrains Mono fonts
- [x] Set base styles (background, text color)
- [x] Remove old vigia-* color variables
- [x] Test font rendering

**Dependencies**: TASK-UI-1.2  
**Estimated Time**: 15 minutes  
**Status**: ✅ COMPLETED

---

## Phase 2: Sidebar Explorer

### TASK-UI-2.1: Create Sidebar Component
- [x] Create `Sidebar.tsx` with fixed 260px width
- [x] Add background (#F5F5F5) and right border
- [x] Add header: "EXPLORER" (Inter, 14px, 600 weight)
- [x] Add padding (16px)

**Dependencies**: TASK-UI-1.1  
**Estimated Time**: 20 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-2.2: Create Folder Tree Structure
- [x] Create `FolderTree.tsx` component
- [x] Implement nested folder structure:
  - 📁 Sessions
  - 📁 Live Streams
- [x] Add chevron icons (right = collapsed, down = expanded)
- [x] Implement expand/collapse logic

**Dependencies**: TASK-UI-2.1  
**Estimated Time**: 45 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-2.3: Add Folder Items
- [x] Create `FolderItem.tsx` component
- [x] Add hover state (#E5E7EB background)
- [x] Add active state (border-left: 2px solid #000000)
- [x] Implement nested indentation (16px per level)
- [x] Add icons (Lucide React: FolderIcon, FileIcon, VideoIcon)

**Dependencies**: TASK-UI-2.2  
**Estimated Time**: 30 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-2.4: Integrate Sentinel Eye Link
- [x] Add "📹 Sentinel Eye (Active)" item under Live Streams
- [x] Link to Sentinel Eye panel toggle
- [x] Add active indicator (green dot)

**Dependencies**: TASK-UI-2.3  
**Estimated Time**: 15 minutes  
**Status**: ✅ COMPLETED

---

## Phase 3: Tabbed Map Stage

### TASK-UI-3.1: Create Tab Bar Component
- [x] Create `TabBar.tsx` with horizontal layout
- [x] Add background (#F5F5F5) and bottom border
- [x] Set height (40px)
- [x] Add padding (8px 16px per tab)

**Dependencies**: TASK-UI-1.1  
**Estimated Time**: 20 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-3.2: Create Tab Component
- [x] Create `Tab.tsx` with label and close button
- [x] Add active state (border-bottom: 2px solid #000000)
- [x] Add hover state (#E5E7EB background)
- [x] Implement close functionality (× icon)
- [x] Use Inter font (12px, 400 weight)

**Dependencies**: TASK-UI-3.1  
**Estimated Time**: 30 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-3.3: Add Breadcrumb Bar
- [x] Create `Breadcrumb.tsx` component
- [x] Add container (height: 32px, background: #F5F5F5)
- [x] Display path: "World > India > Odisha > Rourkela"
- [x] Use Inter font (11px, 400 weight)
- [x] Add separator styling (> with #9CA3AF color)

**Dependencies**: TASK-UI-3.1  
**Estimated Time**: 25 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-3.4: Integrate LiveMap Component
- [x] Update `LiveMap.tsx` to use monochrome styling
- [x] Change map style to "Light Gray Canvas"
- [x] Update hazard markers:
  - Verified: Black circle (#000000) with white border
  - Unverified: Grey circle (#9CA3AF) with white border
- [x] Remove blue glow effects
- [x] Test marker rendering

**Dependencies**: TASK-UI-3.3  
**Estimated Time**: 45 minutes  
**Status**: ✅ COMPLETED

---

## Phase 4: Bottom Console

### TASK-UI-4.1: Create Console Container
- [x] Create `Console.tsx` with fixed height (200px)
- [x] Add top border (1px solid #CBD5E1)
- [x] Implement collapse/expand functionality
- [x] Add drag handle for resizing
- [x] Set min/max height (100px - 400px)

**Dependencies**: TASK-UI-1.1  
**Estimated Time**: 40 minutes  
**Status**: ✅ COMPLETED (basic version, resizing deferred)

### TASK-UI-4.2: Create Console Tab Bar
- [x] Create `ConsoleTabBar.tsx` component
- [x] Add three tabs: "Agent Traces", "DePIN Ledger", "Terminal"
- [x] Add active tab indicator (border-bottom: 2px solid #000000)
- [x] Use Inter font (12px, 400 weight)
- [x] Implement tab switching logic

**Dependencies**: TASK-UI-4.1  
**Estimated Time**: 30 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-4.3: Integrate Agent Traces
- [x] Update `ReasoningTraceViewer.tsx` to use JetBrains Mono
- [x] Remove blue accent colors
- [x] Use monochrome text (#000000, #6B7280)
- [x] Format as terminal output:
  - Timestamp (10px, #6B7280)
  - Reasoning step (11px, #000000)
  - Action taken (11px, #000000)
- [x] Test trace rendering

**Dependencies**: TASK-UI-4.2  
**Estimated Time**: 35 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-4.4: Integrate DePIN Ledger
- [x] Update `LedgerTicker.tsx` to tabular format
- [x] Create table with columns:
  - Timestamp | Contributor | Hazard Type | Location | Reward
- [x] Use JetBrains Mono (11px, 400 weight)
- [x] Add row hover state (#F5F5F5)
- [x] Remove marquee animation
- [x] Test ledger rendering

**Dependencies**: TASK-UI-4.2  
**Estimated Time**: 40 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-4.5: Add Terminal Tab
- [x] Create `Terminal.tsx` component
- [x] Display system logs (console.log output)
- [x] Use JetBrains Mono (11px, 400 weight)
- [x] Add auto-scroll to bottom
- [x] Format as terminal output (> prefix)

**Dependencies**: TASK-UI-4.2  
**Estimated Time**: 25 minutes  
**Status**: ✅ COMPLETED

---

## Phase 5: Sentinel Eye Docking

### TASK-UI-5.1: Create Docked Panel
- [x] Create `SentinelEyePanel.tsx` component
- [x] Set fixed width (320px)
- [x] Add left border (1px solid #CBD5E1)
- [x] Add background (#F5F5F5)
- [x] Position on right side of layout

**Dependencies**: TASK-UI-1.1  
**Estimated Time**: 20 minutes  
**Status**: ✅ COMPLETED (integrated into tab system)

### TASK-UI-5.2: Integrate VideoUploader
- [x] Move `VideoUploader.tsx` into Sentinel Eye panel
- [x] Update video container styling:
  - Remove rounded corners
  - Use 1px solid borders
  - Set aspect ratio (16:9)
- [x] Update bounding box stroke:
  - Change color to #000000
  - Change width to 2px
- [x] Test video rendering

**Dependencies**: TASK-UI-5.1  
**Estimated Time**: 30 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-5.3: Update HUD Overlays
- [x] Update detection counter styling:
  - Remove blue accent border
  - Use #F5F5F5 background
  - Use #000000 text
  - Use JetBrains Mono font
- [x] Update live scanning indicator:
  - Keep red dot (minimal accent)
  - Use JetBrains Mono font
- [x] Update telemetry log:
  - Use JetBrains Mono font
  - Use monochrome colors (#000000, #6B7280)
- [x] Test overlay rendering

**Dependencies**: TASK-UI-5.2  
**Estimated Time**: 25 minutes  
**Status**: ✅ COMPLETED

### TASK-UI-5.4: Add Panel Toggle
- [x] Add collapse/expand button
- [x] Implement toggle logic (show/hide panel)
- [x] Add transition animation (150ms ease-in-out)
- [x] Link to sidebar "Sentinel Eye" item

**Dependencies**: TASK-UI-5.3  
**Estimated Time**: 20 minutes  
**Status**: ✅ COMPLETED (via tab system)

---

## Phase 6: Polish & Refinement

### TASK-UI-6.1: Update page.tsx
- [ ] Replace current dashboard layout with `IDELayout`
- [ ] Remove old zone-based structure
- [ ] Test all components render correctly
- [ ] Verify no console errors

**Dependencies**: All previous tasks  
**Estimated Time**: 30 minutes

### TASK-UI-6.2: Accessibility Audit
- [ ] Test keyboard navigation (Tab, Escape, Ctrl+B, Ctrl+J)
- [ ] Verify focus indicators (2px solid #000000 outline)
- [ ] Check color contrast ratios (WCAG AA)
- [ ] Test screen reader compatibility

**Dependencies**: TASK-UI-6.1  
**Estimated Time**: 45 minutes

### TASK-UI-6.3: Performance Testing
- [ ] Test ONNX inference performance (target: <100ms)
- [ ] Test map rendering with 1000+ markers
- [ ] Test console log virtualization (>100 entries)
- [ ] Profile component render times

**Dependencies**: TASK-UI-6.1  
**Estimated Time**: 30 minutes

### TASK-UI-6.4: Cross-Browser Testing
- [ ] Test in Chrome (primary)
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Fix any browser-specific issues

**Dependencies**: TASK-UI-6.1  
**Estimated Time**: 30 minutes

### TASK-UI-6.5: Final Visual QA
- [ ] Verify all fonts are correct (Inter vs JetBrains Mono)
- [ ] Verify all colors match design system
- [ ] Verify all borders are 1px solid #CBD5E1
- [ ] Verify all spacing uses 4px base unit
- [ ] Verify all hover/active states work
- [ ] Take screenshots for documentation

**Dependencies**: TASK-UI-6.4  
**Estimated Time**: 45 minutes

---

## Phase 7: Documentation

### TASK-UI-7.1: Update README
- [ ] Add screenshots of new UI
- [ ] Update feature list
- [ ] Add keyboard shortcuts section
- [ ] Update design philosophy section

**Dependencies**: TASK-UI-6.5  
**Estimated Time**: 20 minutes

### TASK-UI-7.2: Create UI Component Guide
- [ ] Document each component's props
- [ ] Add usage examples
- [ ] Add styling guidelines
- [ ] Add accessibility notes

**Dependencies**: TASK-UI-6.5  
**Estimated Time**: 30 minutes

---

## Summary

**Total Tasks**: 35  
**Estimated Total Time**: 13 hours 30 minutes  

**Critical Path**:
1. Layout Skeleton (Phase 1) → 1 hour
2. Sidebar Explorer (Phase 2) → 2 hours
3. Tabbed Map Stage (Phase 3) → 2 hours
4. Bottom Console (Phase 4) → 3 hours
5. Sentinel Eye Docking (Phase 5) → 2 hours
6. Polish & Refinement (Phase 6) → 3.5 hours
7. Documentation (Phase 7) → 1 hour

**Priority Order**:
1. Phase 1 (Foundation)
2. Phase 2 (Sidebar)
3. Phase 3 (Map)
4. Phase 4 (Console)
5. Phase 5 (Sentinel Eye)
6. Phase 6 (Polish)
7. Phase 7 (Docs)

---

## Notes

- All tasks preserve existing AWS/ONNX/Bedrock integration
- No modifications to `hazard-detector.worker.ts`
- No modifications to Lambda/API Gateway code
- Focus on UI/UX wrapper components only
- Test after each phase completion
