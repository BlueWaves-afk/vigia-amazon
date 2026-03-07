import type { MapFile, ScenarioBranch } from '@/types/shared';
import ngeohash from 'ngeohash';

// ── Inlined from @vigia/shared/migration (avoids monorepo resolution issues) ──

function _calcBoundingBox(hazards: any[]) {
  if (hazards.length === 0) return { north: 0, south: 0, east: 0, west: 0 };
  const lats = hazards.map((h: any) => h.lat);
  const lons = hazards.map((h: any) => h.lon);
  return { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lons), west: Math.min(...lons) };
}

function _calcCenterPoint(bb: { north: number; south: number; east: number; west: number }) {
  const lat = (bb.north + bb.south) / 2;
  const lon = (bb.east + bb.west) / 2;
  return { lat, lon, geohash: ngeohash.encode(lat, lon, 7) };
}

function _calcArea(bb: { north: number; south: number; east: number; west: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const h = toRad(bb.north - bb.south) * R;
  const w = toRad(bb.east - bb.west) * R * Math.cos(toRad((bb.north + bb.south) / 2));
  return Math.abs(h * w);
}

function _geohashPrecision(areaKm2: number): number {
  if (areaKm2 > 1000) return 5;
  if (areaKm2 > 100) return 6;
  if (areaKm2 > 10) return 7;
  if (areaKm2 > 1) return 8;
  return 9;
}

function _geohashTiles(bb: { north: number; south: number; east: number; west: number }, precision: number): string[] {
  const step: Record<number, number> = { 5: 0.02197, 6: 0.00549, 7: 0.00137, 8: 0.00034, 9: 0.000086 };
  const s = step[precision] ?? 0.00137;
  const tiles = new Set<string>();
  for (let lat = bb.south; lat <= bb.north; lat += s)
    for (let lon = bb.west; lon <= bb.east; lon += s)
      tiles.add(ngeohash.encode(lat, lon, precision));
  return Array.from(tiles);
}

function _hazardStats(hazards: any[]) {
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const h of hazards) {
    byType[h.type] = (byType[h.type] || 0) + 1;
    bySeverity[String(h.severity)] = (bySeverity[String(h.severity)] || 0) + 1;
  }
  return { hazardsByType: byType, severityDistribution: bySeverity };
}

function isLegacyMapFile(file: any): boolean {
  return file.version === '1.0' && typeof file.timestamp === 'number' && !file.coverage && !file.temporal;
}

function migrateLegacyMapFile(legacy: any): any {
  const bb = _calcBoundingBox(legacy.hazards);
  const center = _calcCenterPoint(bb);
  const area = _calcArea(bb);
  const precision = _geohashPrecision(area);
  const tiles = _geohashTiles(bb, precision);
  const city = legacy.sessionId.split('#')[0] || 'Unknown';
  const displayName = `${city}-${new Date(legacy.timestamp).toISOString().split('T')[0]}-001`;
  const { hazardsByType, severityDistribution } = _hazardStats(legacy.hazards);
  const captureStart = legacy.hazards.length > 0 ? Math.min(...legacy.hazards.map((h: any) => h.timestamp)) : legacy.timestamp;
  const captureEnd   = legacy.hazards.length > 0 ? Math.max(...legacy.hazards.map((h: any) => h.timestamp)) : legacy.timestamp;
  return {
    version: '1.0',
    sessionId: legacy.sessionId,
    displayName,
    coverage: {
      type: area > 100 ? 'city' : area > 10 ? 'neighborhood' : 'custom',
      name: `${city}, Unknown, Unknown`,
      boundingBox: bb, centerPoint: center,
      geohashPrecision: precision, geohashTiles: tiles, areaKm2: area,
    },
    temporal: { captureStart, captureEnd, createdAt: legacy.timestamp, duration: captureEnd - captureStart, status: 'finalized' },
    location: { continent: 'Unknown', country: 'Unknown', state: 'Unknown', region: 'Unknown', city },
    hazards: legacy.hazards,
    metadata: {
      totalHazards: legacy.metadata?.totalHazards ?? legacy.hazards.length,
      hazardsByType, severityDistribution,
      contributors: legacy.metadata?.contributors ?? [],
      dataSource: 'import', tags: [],
    },
  };
}

const DB_NAME = 'VigiaMapFiles';
const DB_VERSION = 3; // Increment for schema changes
const MAP_FILES_STORE = 'mapFiles';
const BRANCHES_STORE = 'branches';
const DIFF_MAPS_STORE = 'diffMaps';
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
        const oldVersion = event.oldVersion;

        // Create or update mapFiles store
        if (!db.objectStoreNames.contains(MAP_FILES_STORE)) {
          const mapStore = db.createObjectStore(MAP_FILES_STORE, { keyPath: 'sessionId' });
          mapStore.createIndex('timestamp', 'temporal.createdAt', { unique: false });
          mapStore.createIndex('displayName', 'displayName', { unique: false });
          mapStore.createIndex('country', 'location.country', { unique: false });
          mapStore.createIndex('state', 'location.state', { unique: false });
          mapStore.createIndex('city', 'location.city', { unique: false });
          mapStore.createIndex('captureStart', 'temporal.captureStart', { unique: false });
          mapStore.createIndex('captureEnd', 'temporal.captureEnd', { unique: false });
          mapStore.createIndex('status', 'temporal.status', { unique: false });
          mapStore.createIndex('coverageType', 'coverage.type', { unique: false });
        } else if (oldVersion < 2) {
          // Migration: add new indexes to existing store
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const mapStore = tx.objectStore(MAP_FILES_STORE);
          
          if (!mapStore.indexNames.contains('displayName')) {
            mapStore.createIndex('displayName', 'displayName', { unique: false });
          }
          if (!mapStore.indexNames.contains('country')) {
            mapStore.createIndex('country', 'location.country', { unique: false });
          }
          if (!mapStore.indexNames.contains('state')) {
            mapStore.createIndex('state', 'location.state', { unique: false });
          }
          if (!mapStore.indexNames.contains('city')) {
            mapStore.createIndex('city', 'location.city', { unique: false });
          }
          if (!mapStore.indexNames.contains('captureStart')) {
            mapStore.createIndex('captureStart', 'temporal.captureStart', { unique: false });
          }
          if (!mapStore.indexNames.contains('captureEnd')) {
            mapStore.createIndex('captureEnd', 'temporal.captureEnd', { unique: false });
          }
          if (!mapStore.indexNames.contains('status')) {
            mapStore.createIndex('status', 'temporal.status', { unique: false });
          }
          if (!mapStore.indexNames.contains('coverageType')) {
            mapStore.createIndex('coverageType', 'coverage.type', { unique: false });
          }
        }

        // Create or update branches store
        if (!db.objectStoreNames.contains(BRANCHES_STORE)) {
          const branchStore = db.createObjectStore(BRANCHES_STORE, { keyPath: 'branchId' });
          branchStore.createIndex('parentMapId', 'parentMapId', { unique: false });
          branchStore.createIndex('timestamp', 'temporal.createdAt', { unique: false });
        }

        // Create diffMaps store
        if (!db.objectStoreNames.contains(DIFF_MAPS_STORE)) {
          const diffStore = db.createObjectStore(DIFF_MAPS_STORE, { keyPath: 'diffId' });
          diffStore.createIndex('createdAt', 'createdAt', { unique: false });
          diffStore.createIndex('sessionAId', 'sessionA.sessionId', { unique: false });
          diffStore.createIndex('sessionBId', 'sessionB.sessionId', { unique: false });
        }
      };
    });
  }

  async saveDiffMap(diffMap: any): Promise<string> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(DIFF_MAPS_STORE, 'readwrite');
      const store = tx.objectStore(DIFF_MAPS_STORE);
      store.put(diffMap);
      
      tx.oncomplete = () => resolve(diffMap.diffId);
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadDiffMap(diffId: string): Promise<any | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(DIFF_MAPS_STORE, 'readonly');
      const store = tx.objectStore(DIFF_MAPS_STORE);
      const request = store.get(diffId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listDiffMaps(): Promise<any[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(DIFF_MAPS_STORE, 'readonly');
      const store = tx.objectStore(DIFF_MAPS_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDiffMap(diffId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(DIFF_MAPS_STORE, 'readwrite');
      const store = tx.objectStore(DIFF_MAPS_STORE);
      store.delete(diffId);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
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
      
      request.onsuccess = () => {
        const file = request.result;
        if (!file) {
          resolve(null);
          return;
        }

        // Auto-migrate legacy files
        if (isLegacyMapFile(file)) {
          const migrated = migrateLegacyMapFile(file) as MapFile;
          // Save migrated version
          this.saveMapFile(migrated).catch(console.error);
          resolve(migrated);
        } else {
          resolve(file);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async listMapFiles(): Promise<MapFile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const request = tx.objectStore(MAP_FILES_STORE).getAll();
      
      request.onsuccess = () => {
        const files = request.result.map((file: any) => {
          // Auto-migrate legacy files
          if (isLegacyMapFile(file)) {
            const migrated = migrateLegacyMapFile(file) as MapFile;
            this.saveMapFile(migrated).catch(console.error);
            return migrated;
          }
          return file;
        });
        resolve(files);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async listMapFilesByCity(city: string): Promise<MapFile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const index = tx.objectStore(MAP_FILES_STORE).index('city');
      const request = index.getAll(city);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async listMapFilesByState(state: string): Promise<MapFile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const index = tx.objectStore(MAP_FILES_STORE).index('state');
      const request = index.getAll(state);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async listMapFilesByCountry(country: string): Promise<MapFile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const index = tx.objectStore(MAP_FILES_STORE).index('country');
      const request = index.getAll(country);
      
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
      // LRU eviction: remove oldest file by creation time
      files.sort((a, b) => a.temporal.createdAt - b.temporal.createdAt);
      await this.deleteMapFile(files[0].sessionId);
    }

    // Check storage quota
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usageMB = (estimate.usage || 0) / (1024 * 1024);
      
      if (usageMB > MAX_SIZE_MB) {
        // Evict oldest files until under quota
        const sortedFiles = files.sort((a, b) => a.temporal.createdAt - b.temporal.createdAt);
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
