# Session Storage Architecture - Browser-Only Implementation

**Date**: 2026-03-07  
**Status**: ✅ IMPLEMENTED

---

## 🎯 Objective

Prevent user-created sessions from being saved to the cloud database to avoid breaking the site when multiple users try it. Instead, use browser storage (sessionStorage for unsaved, localStorage for saved).

---

## 📋 Changes Made

### 1. VFSManager (`packages/frontend/app/lib/vfs-manager.ts`)

**New Storage Strategy**:
- **Preloaded Sessions**: Fetched from API (read-only, prefixed with `preloaded_`)
- **Unsaved Sessions**: Stored in `sessionStorage` (cleared on browser close)
- **Saved Sessions**: Stored in `localStorage` (persists across sessions)

**New Methods**:
```typescript
async createSession(data: SessionData): Promise<SessionFile>
  → Stores in sessionStorage (unsaved)

async saveSession(sessionId: string): Promise<void>
  → Moves from sessionStorage to localStorage

async listSessions(): Promise<SessionFile[]>
  → Returns: preloaded (API) + saved (localStorage) + unsaved (sessionStorage)

async deleteSession(sessionId: string): Promise<void>
  → Only allows deleting user-created sessions (not preloaded)
```

**Storage Keys**:
- `vigia_user_sessions` - localStorage (saved sessions)
- `vigia_unsaved_session` - sessionStorage (current unsaved session)

---

### 2. Page Component (`packages/frontend/app/page.tsx`)

**Updated `saveActiveSession` Function**:
```typescript
// Before: Created session via API and saved to cloud
await vfsManager.createSession(sessionData);

// After: Moves session from sessionStorage to localStorage
await vfsManager.saveSession(sessionId);
```

**Behavior**:
- No longer sends session data to cloud
- Simply moves from temporary to permanent browser storage
- Marks tab as "not dirty" after save

---

### 3. Sidebar Component (`packages/frontend/app/components/Sidebar.tsx`)

**Visual Indicators**:
- Preloaded sessions: `🔒 Session Name` (lock icon)
- Unsaved sessions: `* Session Name` (asterisk)
- Saved sessions: `Session Name` (no prefix)

**Delete Protection**:
```typescript
const isPreloaded = session.sessionId?.startsWith('preloaded_');
if (isPreloaded) {
  alert('Cannot delete preloaded sessions. Only user-created sessions can be deleted.');
  return;
}
```

**Folder Deletion**:
- Filters out preloaded sessions before deletion
- Shows count of preloaded vs. user-created sessions
- Only deletes user-created sessions

---

## 🔄 User Workflow

### Creating a New Session
1. User clicks "New Session" in sidebar
2. Selects location from map
3. Session created and stored in **sessionStorage** (unsaved)
4. Tab shows `* Session Name` (asterisk indicates unsaved)

### Saving a Session
1. User presses `Cmd+S` or clicks "Save Session"
2. Session moves from **sessionStorage** to **localStorage**
3. Tab label updates to remove asterisk
4. Session persists across browser sessions

### Viewing Preloaded Sessions
1. Preloaded sessions fetched from API on load
2. Displayed with 🔒 icon (read-only)
3. Cannot be deleted or modified
4. Serve as demo data for all users

---

## 💾 Storage Limits

**sessionStorage**:
- Limit: ~5-10 MB (browser-dependent)
- Cleared: On browser close
- Use: Single unsaved session at a time

**localStorage**:
- Limit: ~5-10 MB (browser-dependent)
- Cleared: Never (unless user clears browser data)
- Use: Multiple saved sessions

**Recommendation**: Keep max 20 saved sessions per user

---

## 🔒 Security & Privacy

**Benefits**:
1. **No Cloud Pollution**: User experiments don't affect database
2. **Privacy**: User data stays in browser
3. **Scalability**: No server load from user sessions
4. **Demo Stability**: Preloaded sessions remain intact

**Trade-offs**:
1. Sessions not synced across devices
2. Lost if user clears browser data
3. Limited storage capacity

---

## 🧪 Testing

### Test 1: Create Unsaved Session
1. Click "New Session" → Select location
2. Verify: Session appears with `*` prefix
3. Close browser → Reopen
4. Verify: Session is gone (sessionStorage cleared)

### Test 2: Save Session
1. Create session → Press `Cmd+S`
2. Verify: `*` prefix removed
3. Close browser → Reopen
4. Verify: Session still exists (localStorage persisted)

### Test 3: Delete Protection
1. Right-click preloaded session (🔒 icon)
2. Click "Delete"
3. Verify: Alert shows "Cannot delete preloaded sessions"

### Test 4: Multiple Users
1. Open site in two different browsers
2. Create sessions in both
3. Verify: Sessions are independent (no cloud sync)
4. Verify: Preloaded sessions visible in both

---

## 📊 Storage Structure

**sessionStorage** (unsaved):
```json
{
  "vigia_unsaved_session": {
    "sessionId": "9q8yy12#2026-03-07T18:00:00Z",
    "userId": "default",
    "geohash7": "9q8yy12",
    "timestamp": "2026-03-07T18:00:00Z",
    "hazardCount": 5,
    "verifiedCount": 2,
    "status": "draft",
    "location": { "city": "San Francisco", ... },
    "hazards": [...]
  }
}
```

**localStorage** (saved):
```json
{
  "vigia_user_sessions": [
    {
      "sessionId": "9q8yy12#2026-03-07T18:00:00Z",
      "userId": "default",
      "geohash7": "9q8yy12",
      "timestamp": "2026-03-07T18:00:00Z",
      "hazardCount": 5,
      "verifiedCount": 2,
      "status": "finalized",
      "location": { "city": "San Francisco", ... },
      "hazards": [...]
    },
    ...
  ]
}
```

---

## 🚀 Future Enhancements

1. **Export/Import**: Allow users to download sessions as `.map` files
2. **Cloud Sync (Optional)**: Add opt-in cloud backup for logged-in users
3. **Storage Quota UI**: Show remaining storage capacity
4. **Auto-Save**: Periodically save to localStorage (every 5 minutes)
5. **Session History**: Track changes with undo/redo

---

## ✅ Success Criteria

- [x] User-created sessions stored in browser only
- [x] Preloaded sessions remain read-only
- [x] Visual indicators for session types (🔒, *)
- [x] Delete protection for preloaded sessions
- [x] Save functionality moves from sessionStorage to localStorage
- [x] No cloud API calls for user sessions
- [x] Multiple users can use site without conflicts

---

**Status**: Production ready! Users can now create and save sessions without affecting the cloud database. 🎉
