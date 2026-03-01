# VIGIA Map-as-a-File-System (MFS) - Implementation Tasks

## Phase 1: Foundation (Data Layer)

### TASK-MFS-1.1: DynamoDB Table Setup
- [ ] Create `SessionFiles` table with schema:
  - PK: `userId` (String)
  - SK: `sessionId` (String) = `{geohash7}#{timestamp}`
  - Attributes: geohash7, timestamp, hazardCount, verifiedCount, contributorId, fileHash, parentHash, status, location, hazards, metadata, ttl
- [ ] Create GSI-1: `geohash7-timestamp-index`
- [ ] Create GSI-2: `status-timestamp-index`
- [ ] Enable TTL on `ttl` attribute (90 days)
- [ ] Test table creation with CDK

**Dependencies**: None  
**Estimated Time**: 30 minutes

### TASK-MFS-1.2: Ledger Table Setup
- [ ] Create `LedgerEntries` table with schema:
  - PK: `ledgerId` (String) = `"ledger"`
  - SK: `timestamp` (String, ISO 8601)
  - Attributes: sessionId, action, previousHash, currentHash, contributorId
- [ ] Enable DynamoDB Streams for audit trail
- [ ] Test ledger write operations

**Dependencies**: None  
**Estimated Time**: 20 minutes

### TASK-MFS-1.3: IndexedDB Schema
- [ ] Define `LocalSessions` store schema
- [ ] Implement IndexedDB wrapper with methods:
  - `put(session)`: Store session locally
  - `get(sessionId)`: Retrieve session
  - `getAll()`: Get all cached sessions
  - `delete(sessionId)`: Remove session
- [ ] Add LRU eviction logic (max 100 sessions, 500 MB)
- [ ] Test IndexedDB operations in browser

**Dependencies**: None  
**Estimated Time**: 45 minutes

---

## Phase 2: Backend API (Lambda Functions)

### TASK-MFS-2.1: Session CRUD Lambda
- [ ] Create Lambda function: `SessionCRUDHandler`
- [ ] Implement POST `/sessions` (create session)
- [ ] Implement GET `/sessions/{sessionId}` (get session)
- [ ] Implement PUT `/sessions/{sessionId}` (update session)
- [ ] Implement DELETE `/sessions/{sessionId}` (delete session)
- [ ] Add input validation (Zod schema)
- [ ] Add error handling (try/catch with proper status codes)
- [ ] Test with sample session data

**Dependencies**: TASK-MFS-1.1  
**Estimated Time**: 1 hour

### TASK-MFS-2.2: Geohash Resolver Lambda
- [ ] Create Lambda function: `GeohashResolverHandler`
- [ ] Implement geohash decoding (lat/lon extraction)
- [ ] Integrate Amazon Location Service `searchPlaceIndexForPosition`
- [ ] Extract geographical hierarchy (continent, country, region, city)
- [ ] Handle reverse geocoding failures (fallback to "Uncategorized")
- [ ] Cache results in Lambda memory (5-minute TTL)
- [ ] Test with sample geohashes

**Dependencies**: None  
**Estimated Time**: 45 minutes

### TASK-MFS-2.3: Hash Chain Validator Lambda
- [ ] Create Lambda function: `HashChainValidatorHandler`
- [ ] Implement GET `/sessions/{sessionId}/validate` endpoint
- [ ] Query ledger entries for session
- [ ] Validate hash chain integrity (previousHash === previous.currentHash)
- [ ] Return validation result: `{ valid: boolean, brokenAt?: number }`
- [ ] Test with sample ledger data

**Dependencies**: TASK-MFS-1.2  
**Estimated Time**: 30 minutes

### TASK-MFS-2.4: API Gateway Configuration
- [ ] Create REST API: `VigiaSessionsAPI`
- [ ] Add routes:
  - POST `/sessions`
  - GET `/sessions/{sessionId}`
  - PUT `/sessions/{sessionId}`
  - DELETE `/sessions/{sessionId}`
  - GET `/sessions/{sessionId}/validate`
  - POST `/geohash/resolve`
- [ ] Configure CORS (allow localhost:3000)
- [ ] Add Cognito authorizer (optional for demo)
- [ ] Test all endpoints with Postman/curl

**Dependencies**: TASK-MFS-2.1, TASK-MFS-2.2, TASK-MFS-2.3  
**Estimated Time**: 30 minutes

---

## Phase 3: Frontend VFS Layer

### TASK-MFS-3.1: VFS Manager Implementation
- [ ] Create `VFSManager` class in `app/lib/vfs-manager.ts`
- [ ] Implement `createSession(data)` method
- [ ] Implement `openSession(sessionId)` method
- [ ] Implement `deleteSession(sessionId)` method
- [ ] Implement `listSessions(path)` method
- [ ] Implement `searchSessions(query)` method
- [ ] Add hash computation logic (SHA-256)
- [ ] Add parent hash retrieval logic
- [ ] Test with mock data

**Dependencies**: TASK-MFS-1.3, TASK-MFS-2.1  
**Estimated Time**: 1.5 hours

### TASK-MFS-3.2: API Client
- [ ] Create `APIClient` class in `app/lib/api-client.ts`
- [ ] Implement methods for all API endpoints:
  - `createSession(session)`
  - `getSession(sessionId)`
  - `updateSession(sessionId, data)`
  - `deleteSession(sessionId)`
  - `validateSession(sessionId)`
  - `resolveGeohash(geohash7)`
- [ ] Add retry logic (exponential backoff)
- [ ] Add request/response logging
- [ ] Test with real API Gateway endpoints

**Dependencies**: TASK-MFS-2.4  
**Estimated Time**: 45 minutes

### TASK-MFS-3.3: Sync Engine
- [ ] Create `SyncEngine` class in `app/lib/sync-engine.ts`
- [ ] Implement `syncSession(sessionId)` method
- [ ] Implement `syncAll()` method
- [ ] Implement `processQueue()` method for offline sync
- [ ] Add online/offline detection (navigator.onLine)
- [ ] Add conflict resolution (last-write-wins)
- [ ] Test sync scenarios (local newer, remote newer, same version)

**Dependencies**: TASK-MFS-3.1, TASK-MFS-3.2  
**Estimated Time**: 1 hour

---

## Phase 4: Sidebar Tree View

### TASK-MFS-4.1: Tree Node Component
- [ ] Create `TreeNode.tsx` component
- [ ] Add props: `node`, `selected`, `onExpand`, `onSelect`, `onContextMenu`
- [ ] Implement expand/collapse animation
- [ ] Add icon rendering (📁 📄 ✅ 📌 🔄 📴 ⚠️ 🗄️)
- [ ] Add indentation based on depth (16px per level)
- [ ] Add hover state styling
- [ ] Test with sample tree data

**Dependencies**: None  
**Estimated Time**: 45 minutes

### TASK-MFS-4.2: Session Tree Component
- [ ] Create `SessionTree.tsx` component
- [ ] Implement lazy loading (load children on expand)
- [ ] Add virtualization using `react-window` or `react-virtual`
- [ ] Implement multi-select (Ctrl+Click)
- [ ] Add context menu (right-click):
  - Open
  - Pin Context
  - Compare (if 2 files selected)
  - Verify Integrity
  - Force Sync
  - Export as JSON
  - Archive
- [ ] Add search bar with filters (geohash, location, date, status)
- [ ] Test with 10,000+ files

**Dependencies**: TASK-MFS-4.1, TASK-MFS-3.1  
**Estimated Time**: 2 hours

### TASK-MFS-4.3: Integrate into Sidebar
- [ ] Update `Sidebar.tsx` to include `SessionTree`
- [ ] Add "Sessions" folder at top level
- [ ] Add "Live Streams" folder (existing Sentinel Eye)
- [ ] Test tree rendering in sidebar
- [ ] Test expand/collapse functionality
- [ ] Test file selection and context menu

**Dependencies**: TASK-MFS-4.2  
**Estimated Time**: 30 minutes

---

## Phase 5: Sentinel Eye Integration

### TASK-MFS-5.1: Session Builder
- [ ] Create `SessionBuilder` class in `app/lib/session-builder.ts`
- [ ] Implement `buildFromDetection(telemetry, metadata)` method
- [ ] Compute geohash7 from GPS coordinates
- [ ] Generate sessionId: `{geohash7}#{timestamp}`
- [ ] Aggregate hazards from telemetry batch
- [ ] Add metadata (videoFile, duration, fps, modelVersion)
- [ ] Test with sample telemetry data

**Dependencies**: None  
**Estimated Time**: 30 minutes  
**Status**: ⏭️ SKIPPED (deferred to later)

### TASK-MFS-5.2: Save Session Dialog
- [ ] Create `SaveSessionDialog.tsx` component
- [ ] Add prompt: "Save session as file?"
- [ ] Add input field for custom filename (optional)
- [ ] Add "Auto-Save" toggle in Settings
- [ ] Implement save logic (call VFSManager.createSession)
- [ ] Display success notification: "Session saved: {filename}"
- [ ] Test save flow from Sentinel Eye

**Dependencies**: TASK-MFS-5.1, TASK-MFS-3.1  
**Estimated Time**: 45 minutes  
**Status**: ⏭️ SKIPPED (deferred to later)

### TASK-MFS-5.3: Update VideoUploader
- [ ] Add "Stop Detection" button handler
- [ ] Trigger `SaveSessionDialog` on stop
- [ ] Pass telemetry batch and metadata to SessionBuilder
- [ ] Handle save confirmation/cancellation
- [ ] Add "Saving..." indicator during save
- [ ] Test end-to-end save flow

**Dependencies**: TASK-MFS-5.2  
**Estimated Time**: 30 minutes  
**Status**: ⏭️ SKIPPED (deferred to later)

---

## Phase 6: Context Pinning (SKIPPED - Not Critical for MVP)

---

## Phase 7: Diff Viewer (SKIPPED - Not Critical for MVP)

---

## Phase 8: Hash Chain Auditability (SKIPPED - Not Critical for MVP)

---

## Phase 9: Polish & Testing

### TASK-MFS-9.1: Error Handling
- [ ] Add error boundaries to all components
- [ ] Display user-friendly error messages
- [ ] Add retry logic for failed API calls
- [ ] Add loading states for async operations
- [ ] Test error scenarios (network failure, invalid data)

**Dependencies**: All previous tasks  
**Estimated Time**: 1 hour

### TASK-MFS-9.2: Performance Optimization
- [ ] Profile sidebar rendering with 10,000+ files
- [ ] Optimize virtualization (react-window)
- [ ] Add debouncing to search input (300ms)
- [ ] Lazy load session metadata (fetch on demand)
- [ ] Test performance with large datasets

**Dependencies**: TASK-MFS-4.2  
**Estimated Time**: 1 hour

### TASK-MFS-9.3: Accessibility
- [ ] Add keyboard navigation (Tab, Enter, Escape)
- [ ] Add ARIA labels to all interactive elements
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Ensure color contrast meets WCAG AA
- [ ] Add focus indicators

**Dependencies**: All previous tasks  
**Estimated Time**: 45 minutes

### TASK-MFS-9.4: Documentation
- [ ] Update README with MFS feature description
- [ ] Add usage guide (how to create/open/compare sessions)
- [ ] Document API endpoints
- [ ] Add troubleshooting section
- [ ] Create demo video (2-3 minutes)

**Dependencies**: All previous tasks  
**Estimated Time**: 1 hour

---

## Summary

**Total Tasks**: 35  
**Estimated Total Time**: 22 hours  

**Critical Path**:
1. Phase 1: Foundation (1.5 hours)
2. Phase 2: Backend API (3 hours)
3. Phase 3: Frontend VFS Layer (3.5 hours)
4. Phase 4: Sidebar Tree View (3.5 hours)
5. Phase 5: Sentinel Eye Integration (2 hours)
6. Phase 6: Context Pinning (2.5 hours)
7. Phase 7: Diff Viewer (3 hours)
8. Phase 8: Hash Chain Auditability (2 hours)
9. Phase 9: Polish & Testing (4 hours)

**Priority Order**:
1. Phase 1 (Foundation) - Required for all other phases
2. Phase 2 (Backend API) - Required for data persistence
3. Phase 3 (Frontend VFS Layer) - Core abstraction
4. Phase 5 (Sentinel Eye Integration) - User-facing feature
5. Phase 4 (Sidebar Tree View) - Navigation
6. Phase 7 (Diff Viewer) - High-value feature
7. Phase 6 (Context Pinning) - AI enhancement
8. Phase 8 (Hash Chain Auditability) - Trust layer
9. Phase 9 (Polish & Testing) - Final touches

---

## Notes

- All tasks preserve existing AWS integration (Bedrock, Location Service, DynamoDB)
- No modifications to ONNX worker logic or Lambda validation
- Focus on VFS abstraction and UI components
- Test after each phase completion
- Deploy incrementally (backend first, then frontend)
