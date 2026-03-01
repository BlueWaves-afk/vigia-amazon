# VIGIA Map-as-a-File-System (MFS) - Requirements Specification

## Product Vision

Transform geographical regions into a hierarchical file system where each "file" represents a road infrastructure session tied to a Geohash (Precision 7, ~150m resolution). Users interact with road data as if navigating a code repository, enabling version control, diff analysis, and context-aware AI reasoning.

---

## Functional Requirements

### FR-MFS-1: Session File Creation

**FR-MFS-1.1**: WHEN a user completes a Sentinel Eye detection session, THE SYSTEM SHALL generate a session file with filename format: `{geohash7}_{timestamp}.vigia`

**FR-MFS-1.2**: THE SYSTEM SHALL store session metadata in DynamoDB with attributes:
- `sessionId` (PK): `{geohash7}#{timestamp}`
- `geohash7`: 7-character geohash (e.g., `9q8yy4k`)
- `timestamp`: ISO 8601 format
- `hazardCount`: Integer count of detected hazards
- `verifiedCount`: Integer count of verified hazards
- `contributorId`: String identifier
- `fileHash`: SHA-256 hash of session content
- `parentHash`: SHA-256 hash of previous session in same geohash (for hash chain)
- `status`: Enum (`draft`, `finalized`, `archived`)

**FR-MFS-1.3**: WHEN a session file is created, THE SYSTEM SHALL automatically organize it in the sidebar tree under:
```
📁 World
  📁 {continent}
    📁 {country}
      📁 {region}
        📄 {geohash7}_{timestamp}.vigia
```

**FR-MFS-1.4**: THE SYSTEM SHALL derive geographical hierarchy from geohash using reverse geocoding (Amazon Location Service)

**FR-MFS-1.5**: IF reverse geocoding fails, THE SYSTEM SHALL place the file under `📁 Uncategorized/{geohash7[0:2]}/`

### FR-MFS-2: Context Pinning

**FR-MFS-2.1**: WHEN a user opens a session file, THE SYSTEM SHALL load the file's metadata into the Bedrock Agent context

**FR-MFS-2.2**: THE SYSTEM SHALL provide the following context to Bedrock Agent:
- Session geohash and geographical location
- Hazard count and types
- Verification status
- Historical sessions in the same geohash (up to 10 most recent)
- Neighboring geohash sessions (8 adjacent cells)

**FR-MFS-2.3**: IF a file is pinned (marked with 📌 icon), THE SYSTEM SHALL maintain its context across all Bedrock Agent queries until unpinned

**FR-MFS-2.4**: THE SYSTEM SHALL display pinned context in the Console (Zone 4) under a "Pinned Context" tab

**FR-MFS-2.5**: WHEN multiple files are pinned, THE SYSTEM SHALL merge their contexts and highlight conflicts (e.g., overlapping geohashes)

### FR-MFS-3: Infrastructure Diffs

**FR-MFS-3.1**: WHEN a user selects two session files (Ctrl+Click), THE SYSTEM SHALL enable a "Compare" action in the context menu

**FR-MFS-3.2**: WHEN "Compare" is triggered, THE SYSTEM SHALL calculate:
- Delta in hazard count: `Δ = session2.hazardCount - session1.hazardCount`
- Delta in verification rate: `Δ% = (session2.verifiedCount / session2.hazardCount) - (session1.verifiedCount / session1.hazardCount)`
- New hazards: Hazards in session2 not present in session1
- Resolved hazards: Hazards in session1 not present in session2

**FR-MFS-3.3**: THE SYSTEM SHALL visualize the diff in a split-pane view:
- Left pane: Session 1 map with hazards
- Right pane: Session 2 map with hazards
- Center divider: Diff summary (Δ hazards, Δ verification rate)
- Color coding: Green for improvements, Red for degradation, Yellow for new hazards

**FR-MFS-3.4**: IF the two sessions are from the same geohash, THE SYSTEM SHALL display a timeline showing hazard evolution

**FR-MFS-3.5**: IF the two sessions are from different geohashes, THE SYSTEM SHALL display a geographical comparison with distance and route overlay

**FR-MFS-3.6**: THE SYSTEM SHALL allow exporting the diff as a JSON report with schema:
```json
{
  "session1": { "sessionId": "...", "hazardCount": 10 },
  "session2": { "sessionId": "...", "hazardCount": 15 },
  "delta": { "hazards": 5, "verificationRate": 0.15 },
  "newHazards": [...],
  "resolvedHazards": [...]
}
```

### FR-MFS-4: Tamper-Proof Auditability

**FR-MFS-4.1**: WHEN a session file is created, THE SYSTEM SHALL compute its hash:
```
fileHash = SHA256(sessionId + geohash7 + timestamp + hazardCount + verifiedCount + contributorId)
```

**FR-MFS-4.2**: THE SYSTEM SHALL link the new session to the previous session in the same geohash via `parentHash`

**FR-MFS-4.3**: IF no previous session exists for the geohash, `parentHash` SHALL be set to `"genesis"`

**FR-MFS-4.4**: WHEN a session file is modified (e.g., verification status updated), THE SYSTEM SHALL:
1. Create a new session file with updated data
2. Set the new file's `parentHash` to the previous file's `fileHash`
3. Mark the previous file as `archived`
4. Update the hash chain in the Ledger Table (Zone 4)

**FR-MFS-4.5**: THE SYSTEM SHALL write a ledger entry to DynamoDB with attributes:
- `ledgerId` (PK): `ledger`
- `timestamp` (SK): ISO 8601 format
- `sessionId`: Reference to session file
- `action`: Enum (`created`, `updated`, `verified`, `archived`)
- `previousHash`: Hash of previous ledger entry
- `currentHash`: SHA-256 hash of current ledger entry
- `contributorId`: String identifier

**FR-MFS-4.6**: THE SYSTEM SHALL validate hash chain integrity on startup by verifying:
```
currentHash = SHA256(timestamp + sessionId + action + previousHash + contributorId)
```

**FR-MFS-4.7**: IF hash chain validation fails, THE SYSTEM SHALL display a warning in the Console and mark affected sessions with a ⚠️ icon

**FR-MFS-4.8**: THE SYSTEM SHALL provide a "Verify Integrity" action in the sidebar context menu that re-validates the hash chain for a selected session

### FR-MFS-5: Sync-on-Open Mechanism

**FR-MFS-5.1**: WHEN a user opens a session file, THE SYSTEM SHALL asynchronously query DynamoDB for:
- Latest hazard updates in the session's geohash
- New sessions created in the same geohash since last sync
- Verification status updates from Bedrock Agent

**FR-MFS-5.2**: THE SYSTEM SHALL maintain a local immutable history in IndexedDB with schema:
```typescript
{
  sessionId: string;
  geohash7: string;
  timestamp: string;
  hazards: Hazard[];
  metadata: SessionMetadata;
  syncedAt: string;
  version: number;
}
```

**FR-MFS-5.3**: IF the remote session has a newer version, THE SYSTEM SHALL:
1. Display a notification: "Session {geohash7} has updates. Sync now?"
2. On user confirmation, fetch the latest version
3. Append the new version to local history (do not overwrite)
4. Update the sidebar tree with a 🔄 icon indicating sync

**FR-MFS-5.4**: IF the user is offline, THE SYSTEM SHALL:
1. Load the session from IndexedDB
2. Display a 📴 icon in the sidebar
3. Queue any local changes for sync when online

**FR-MFS-5.5**: WHEN the user goes back online, THE SYSTEM SHALL:
1. Sync queued changes to DynamoDB
2. Fetch remote updates
3. Resolve conflicts using "last-write-wins" strategy (based on timestamp)
4. Update the sidebar tree and remove 📴 icons

**FR-MFS-5.6**: THE SYSTEM SHALL provide a "Force Sync" action in the sidebar context menu that triggers immediate sync for a selected session

### FR-MFS-6: Sidebar Tree View

**FR-MFS-6.1**: THE SYSTEM SHALL display the file tree in the left sidebar (Explorer) with collapsible folders

**FR-MFS-6.2**: THE SYSTEM SHALL use icons to indicate file status:
- 📄 Draft session (not finalized)
- ✅ Finalized session (all hazards verified)
- 📌 Pinned session (context active)
- 🔄 Syncing session (remote update in progress)
- 📴 Offline session (local-only)
- ⚠️ Integrity warning (hash chain broken)
- 🗄️ Archived session (superseded by newer version)

**FR-MFS-6.3**: WHEN a user right-clicks a session file, THE SYSTEM SHALL display a context menu with actions:
- Open
- Pin Context
- Compare (if 2 files selected)
- Verify Integrity
- Force Sync
- Export as JSON
- Archive

**FR-MFS-6.4**: THE SYSTEM SHALL support multi-select (Ctrl+Click) for batch operations

**FR-MFS-6.5**: THE SYSTEM SHALL display file metadata on hover (tooltip):
- Geohash and location name
- Timestamp
- Hazard count
- Verification rate
- File size (in KB)

**FR-MFS-6.6**: THE SYSTEM SHALL provide a search bar above the tree view that filters files by:
- Geohash
- Location name
- Date range
- Hazard type
- Verification status

### FR-MFS-7: Sentinel Eye to Session File Save Loop

**FR-MFS-7.1**: WHEN a user clicks "Stop Detection" in Sentinel Eye, THE SYSTEM SHALL prompt: "Save session as file?"

**FR-MFS-7.2**: IF the user confirms, THE SYSTEM SHALL:
1. Compute the geohash7 for the session's GPS coordinates
2. Generate a session file with format: `{geohash7}_{timestamp}.vigia`
3. Write session metadata to DynamoDB
4. Compute file hash and update hash chain
5. Write ledger entry
6. Add the file to the sidebar tree
7. Display a success notification: "Session saved: {filename}"

**FR-MFS-7.3**: IF the user cancels, THE SYSTEM SHALL discard the session data and display: "Session discarded"

**FR-MFS-7.4**: THE SYSTEM SHALL provide an "Auto-Save" toggle in Settings that automatically saves sessions without prompting

**FR-MFS-7.5**: IF Auto-Save is enabled, THE SYSTEM SHALL save sessions every 5 minutes during active detection

**FR-MFS-7.6**: THE SYSTEM SHALL display a "Saving..." indicator in the Sentinel Eye panel during save operations

---

## Non-Functional Requirements

### NFR-MFS-1: Performance

**NFR-MFS-1.1**: Session file creation SHALL complete within 500ms (excluding network latency)

**NFR-MFS-1.2**: Sidebar tree rendering SHALL support 10,000+ files without lag (use virtualization)

**NFR-MFS-1.3**: Diff calculation SHALL complete within 2 seconds for sessions with up to 1,000 hazards each

**NFR-MFS-1.4**: Hash chain validation SHALL process 1,000 entries per second

### NFR-MFS-2: Scalability

**NFR-MFS-2.1**: THE SYSTEM SHALL support up to 100,000 session files per user

**NFR-MFS-2.2**: DynamoDB queries SHALL use pagination (limit: 100 items per page)

**NFR-MFS-2.3**: IndexedDB SHALL store up to 500 MB of local session history

### NFR-MFS-3: Cost Efficiency

**NFR-MFS-3.1**: DynamoDB read/write operations SHALL stay within Free Tier limits (25 GB storage, 25 RCU/WCU)

**NFR-MFS-3.2**: THE SYSTEM SHALL use DynamoDB on-demand billing to avoid over-provisioning

**NFR-MFS-3.3**: THE SYSTEM SHALL compress session metadata using gzip before storing in DynamoDB (target: 50% size reduction)

**NFR-MFS-3.4**: THE SYSTEM SHALL use DynamoDB TTL to auto-delete archived sessions older than 90 days

**NFR-MFS-3.5**: THE SYSTEM SHALL batch DynamoDB writes (up to 25 items per batch) to reduce request count

### NFR-MFS-4: Security

**NFR-MFS-4.1**: Session files SHALL be scoped to the authenticated user (use Cognito user ID as partition key prefix)

**NFR-MFS-4.2**: Hash chain validation SHALL prevent tampering with session history

**NFR-MFS-4.3**: THE SYSTEM SHALL encrypt sensitive metadata (e.g., GPS coordinates) using AWS KMS (Free Tier: 20,000 requests/month)

### NFR-MFS-5: Usability

**NFR-MFS-5.1**: The sidebar tree SHALL use lazy loading (load folders on expand)

**NFR-MFS-5.2**: The diff view SHALL use color-blind-friendly colors (green/red alternatives)

**NFR-MFS-5.3**: All file operations SHALL provide undo functionality (stored in local history)

---

## Data Schema

### DynamoDB Table: `SessionFiles`

```
Partition Key: userId (String)
Sort Key: sessionId (String) = {geohash7}#{timestamp}

Attributes:
- geohash7 (String)
- timestamp (String, ISO 8601)
- hazardCount (Number)
- verifiedCount (Number)
- contributorId (String)
- fileHash (String, SHA-256)
- parentHash (String, SHA-256)
- status (String: draft | finalized | archived)
- location (Map: { continent, country, region, city })
- hazards (List of Maps)
- metadata (Map: { videoFile, duration, fps, modelVersion })
- ttl (Number, Unix timestamp for auto-deletion)
```

**GSI-1**: `geohash7-timestamp-index`
- Partition Key: geohash7
- Sort Key: timestamp
- Purpose: Query all sessions for a specific geohash

**GSI-2**: `status-timestamp-index`
- Partition Key: status
- Sort Key: timestamp
- Purpose: Query all draft/finalized/archived sessions

### DynamoDB Table: `LedgerEntries`

```
Partition Key: ledgerId (String) = "ledger"
Sort Key: timestamp (String, ISO 8601)

Attributes:
- sessionId (String)
- action (String: created | updated | verified | archived)
- previousHash (String, SHA-256)
- currentHash (String, SHA-256)
- contributorId (String)
```

### IndexedDB Store: `LocalSessions`

```typescript
{
  sessionId: string; // Primary key
  geohash7: string;
  timestamp: string;
  hazards: Hazard[];
  metadata: SessionMetadata;
  syncedAt: string;
  version: number;
  localChanges: Change[]; // Pending sync
}
```

---

## Success Criteria

1. ✅ Users can create session files from Sentinel Eye detections
2. ✅ Session files are organized in a hierarchical tree by geography
3. ✅ Users can pin session context for Bedrock Agent queries
4. ✅ Users can compare two sessions and visualize infrastructure diffs
5. ✅ Hash chain ensures tamper-proof auditability
6. ✅ Sync-on-open keeps local and remote data consistent
7. ✅ System stays within AWS Free Tier + $200 credits

---

## Out of Scope

- Real-time collaboration (multiple users editing same session)
- Branching/merging (Git-like version control)
- Session file encryption at rest (use AWS default encryption)
- Mobile app support (desktop-first)
