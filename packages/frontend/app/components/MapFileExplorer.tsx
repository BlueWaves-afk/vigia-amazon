'use client';

import { useEffect, useState } from 'react';
import { useMapFileStore } from '@/stores/mapFileStore';
import type { MapFile, ScenarioBranch } from '@/types/shared';

const FONT_UI   = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

export function MapFileExplorer() {
  const { files, activeFileId, setActiveFile, loadFiles, loadFile, createBranch, computeDiff } = useMapFileStore();
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { await loadFile(file); } catch (error) { console.error('Failed to load file:', error); }
  };

  const handleDragStart  = (fileId: string) => setDraggedFileId(fileId);
  const handleDragLeave  = () => setDropTargetId(null);
  const handleDragOver   = (e: React.DragEvent, fileId: string) => {
    e.preventDefault();
    if (draggedFileId && draggedFileId !== fileId) setDropTargetId(fileId);
  };
  const handleDrop = async (e: React.DragEvent, targetFileId: string) => {
    e.preventDefault();
    if (!draggedFileId || draggedFileId === targetFileId) return;
    try { await computeDiff(targetFileId, draggedFileId); }
    catch (error) { console.error('Failed to compute diff:', error); }
    finally { setDraggedFileId(null); setDropTargetId(null); }
  };
  const handleCreateBranch = async (parentId: string) => {
    try { const id = await createBranch(parentId); setActiveFile(id); }
    catch (error) { console.error('Failed to create branch:', error); }
  };

  const isBranch = (file: MapFile | ScenarioBranch): file is ScenarioBranch => 'branchId' in file;
  const mapFiles = Array.from(files.values()).filter(f => !isBranch(f));
  const branches = Array.from(files.values()).filter(f => isBranch(f)) as ScenarioBranch[];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--c-sidebar)', borderRight: '1px solid var(--c-border)', fontFamily: FONT_UI }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
        <div style={{ fontSize: '0.60rem', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 8 }}>
          Map File System
        </div>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input type="file" accept=".map,.json" onChange={handleFileUpload} style={{ display: 'none' }} />
          <span style={{
            display: 'inline-block', fontSize: '0.70rem', padding: '4px 10px',
            background: 'var(--c-hover)', border: '1px solid var(--c-border)',
            borderRadius: 4, cursor: 'pointer', color: 'var(--c-text-2)',
            transition: 'background var(--dur-fast), color var(--dur-fast)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover-md)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)'; }}
          >
            Upload .map File
          </span>
        </label>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
        {mapFiles.map((file) => {
          const isActive    = activeFileId === file.sessionId;
          const isDropTarget = dropTargetId === file.sessionId;
          const fileBranches = branches.filter(b => b.parentMapId === file.sessionId);

          return (
            <div key={file.sessionId} style={{ marginBottom: 2 }}>
              <div
                draggable
                onDragStart={() => handleDragStart(file.sessionId)}
                onDragOver={(e) => handleDragOver(e, file.sessionId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, file.sessionId)}
                onClick={() => setActiveFile(file.sessionId)}
                onContextMenu={(e) => { e.preventDefault(); handleCreateBranch(file.sessionId); }}
                style={{
                  padding: '4px 8px', fontSize: '0.72rem', borderRadius: 4,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  background: isActive ? 'var(--c-accent-glow)' : isDropTarget ? 'var(--c-rose-dim)' : 'transparent',
                  border: isDropTarget ? '1px solid var(--c-accent-2)' : '1px solid transparent',
                  color: isActive ? 'var(--c-text)' : 'var(--c-text-2)',
                  fontFamily: FONT_MONO,
                  transition: 'background var(--dur-fast)',
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {isActive && <span style={{ position: 'absolute', left: 4, top: '20%', bottom: '20%', width: 2, borderRadius: 1, background: 'var(--c-accent-2)' }} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.sessionId}
                </span>
              </div>

              {fileBranches.length > 0 && (
                <div style={{ marginLeft: 16, marginTop: 2 }}>
                  {fileBranches.map((branch) => {
                    const branchActive = activeFileId === branch.branchId;
                    return (
                      <div
                        key={branch.branchId}
                        onClick={() => setActiveFile(branch.branchId)}
                        style={{
                          padding: '3px 8px', fontSize: '0.70rem', borderRadius: 4,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                          background: branchActive ? 'var(--c-accent-glow)' : 'transparent',
                          color: branchActive ? 'var(--c-text)' : 'var(--c-text-2)',
                          transition: 'background var(--dur-fast)',
                        }}
                        onMouseEnter={(e) => { if (!branchActive) (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'; }}
                        onMouseLeave={(e) => { if (!branchActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: '0.60rem', color: 'var(--c-green)', fontFamily: FONT_MONO, flexShrink: 0 }}>⎇</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT_MONO }}>
                          {branch.branchName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {mapFiles.length === 0 && (
          <div style={{ fontSize: '0.72rem', color: 'var(--c-text-3)', textAlign: 'center', padding: '20px 12px', lineHeight: 1.7 }}>
            No map files loaded
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--c-border)', flexShrink: 0 }}>
        <div style={{ fontSize: '0.66rem', color: 'var(--c-text-3)', fontFamily: FONT_MONO }}>
          Files: {mapFiles.length}/20
        </div>
        <div style={{ fontSize: '0.60rem', color: 'var(--c-text-3)', marginTop: 3, lineHeight: 1.6 }}>
          Drag onto another to compare<br />
          Right-click to branch
        </div>
      </div>
    </div>
  );
}
