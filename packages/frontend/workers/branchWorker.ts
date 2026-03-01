import type { MapFile, ScenarioBranch, Hazard } from '@vigia/shared';
import { v4 as uuidv4 } from 'uuid';

interface BranchWorkerMessage {
  type: 'CREATE_BRANCH' | 'UPDATE_BRANCH' | 'LOAD_BRANCH';
  parentFile?: MapFile;
  branchId?: string;
  branchName?: string;
  simulatedChanges?: ScenarioBranch['simulatedChanges'];
}

interface BranchWorkerResponse {
  type: 'BRANCH_CREATED' | 'BRANCH_UPDATED' | 'BRANCH_LOADED';
  branch: ScenarioBranch;
}

self.onmessage = async (e: MessageEvent<BranchWorkerMessage>) => {
  const { type, parentFile, branchId, branchName, simulatedChanges } = e.data;

  if (type === 'CREATE_BRANCH' && parentFile) {
    const branch: ScenarioBranch = {
      ...parentFile,
      parentMapId: parentFile.sessionId,
      branchId: uuidv4(),
      branchName: branchName || `Branch ${new Date().toISOString()}`,
      simulatedChanges: {
        addedHazards: [],
        removedHazards: [],
        modifiedSeverity: [],
      },
    };

    // Store in IndexedDB
    await saveBranchToIndexedDB(branch);

    const response: BranchWorkerResponse = { type: 'BRANCH_CREATED', branch };
    self.postMessage(response);
  } else if (type === 'UPDATE_BRANCH' && branchId && simulatedChanges) {
    const branch = await loadBranchFromIndexedDB(branchId);
    if (branch) {
      branch.simulatedChanges = simulatedChanges;
      branch.timestamp = Date.now();
      await saveBranchToIndexedDB(branch);

      const response: BranchWorkerResponse = { type: 'BRANCH_UPDATED', branch };
      self.postMessage(response);
    }
  }
};

// IndexedDB helpers
async function saveBranchToIndexedDB(branch: ScenarioBranch): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('branches', 'readwrite');
    const store = tx.objectStore('branches');
    store.put(branch);
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadBranchFromIndexedDB(branchId: string): Promise<ScenarioBranch | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('branches', 'readonly');
    const request = tx.objectStore('branches').get(branchId);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VigiaMapFiles', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('branches')) {
        db.createObjectStore('branches', { keyPath: 'branchId' });
      }
      if (!db.objectStoreNames.contains('mapFiles')) {
        db.createObjectStore('mapFiles', { keyPath: 'sessionId' });
      }
    };
  });
}
