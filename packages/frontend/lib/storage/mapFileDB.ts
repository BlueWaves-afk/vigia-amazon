import type { MapFile, ScenarioBranch } from '@vigia/shared';

const DB_NAME = 'VigiaMapFiles';
const DB_VERSION = 1;
const MAP_FILES_STORE = 'mapFiles';
const BRANCHES_STORE = 'branches';
const MAX_FILES = 20;
const MAX_SIZE_MB = 50;

class MapFileDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(MAP_FILES_STORE)) {
          const mapStore = db.createObjectStore(MAP_FILES_STORE, { keyPath: 'sessionId' });
          mapStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(BRANCHES_STORE)) {
          const branchStore = db.createObjectStore(BRANCHES_STORE, { keyPath: 'branchId' });
          branchStore.createIndex('parentMapId', 'parentMapId', { unique: false });
          branchStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveMapFile(file: MapFile): Promise<string> {
    await this.init();
    await this.enforceQuota();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readwrite');
      const store = tx.objectStore(MAP_FILES_STORE);
      store.put(file);
      
      tx.oncomplete = () => resolve(file.sessionId);
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadMapFile(sessionId: string): Promise<MapFile | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const request = tx.objectStore(MAP_FILES_STORE).get(sessionId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listMapFiles(): Promise<MapFile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const request = tx.objectStore(MAP_FILES_STORE).getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveBranch(branch: ScenarioBranch): Promise<string> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BRANCHES_STORE, 'readwrite');
      const store = tx.objectStore(BRANCHES_STORE);
      store.put(branch);
      
      tx.oncomplete = () => resolve(branch.branchId);
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadBranch(branchId: string): Promise<ScenarioBranch | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BRANCHES_STORE, 'readonly');
      const request = tx.objectStore(BRANCHES_STORE).get(branchId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listBranches(parentMapId?: string): Promise<ScenarioBranch[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BRANCHES_STORE, 'readonly');
      const store = tx.objectStore(BRANCHES_STORE);

      if (parentMapId) {
        const index = store.index('parentMapId');
        const request = index.getAll(parentMapId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    });
  }

  async deleteMapFile(sessionId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readwrite');
      const store = tx.objectStore(MAP_FILES_STORE);
      store.delete(sessionId);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteBranch(branchId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BRANCHES_STORE, 'readwrite');
      const store = tx.objectStore(BRANCHES_STORE);
      store.delete(branchId);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async enforceQuota(): Promise<void> {
    const files = await this.listMapFiles();
    
    if (files.length >= MAX_FILES) {
      // LRU eviction: remove oldest file
      files.sort((a, b) => a.timestamp - b.timestamp);
      await this.deleteMapFile(files[0].sessionId);
      console.log(`[MapFileDB] Evicted oldest file: ${files[0].sessionId}`);
    }

    // Check storage quota
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usageMB = (estimate.usage || 0) / (1024 * 1024);
      
      if (usageMB > MAX_SIZE_MB) {
        // Evict oldest files until under quota
        const sortedFiles = files.sort((a, b) => a.timestamp - b.timestamp);
        for (const file of sortedFiles) {
          await this.deleteMapFile(file.sessionId);
          const newEstimate = await navigator.storage.estimate();
          const newUsageMB = (newEstimate.usage || 0) / (1024 * 1024);
          if (newUsageMB <= MAX_SIZE_MB) break;
        }
      }
    }
  }
}

export const mapFileDB = new MapFileDB();
