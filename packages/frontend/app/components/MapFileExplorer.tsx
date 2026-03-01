'use client';

import { useEffect, useState } from 'react';
import { useMapFileStore } from '@/stores/mapFileStore';
import type { MapFile, ScenarioBranch } from '@/types/shared';

export function MapFileExplorer() {
  const { files, activeFileId, setActiveFile, loadFiles, loadFile, createBranch, computeDiff } = useMapFileStore();
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await loadFile(file);
    } catch (error) {
      console.error('Failed to load file:', error);
    }
  };

  const handleDragStart = (fileId: string) => {
    setDraggedFileId(fileId);
  };

  const handleDragOver = (e: React.DragEvent, fileId: string) => {
    e.preventDefault();
    if (draggedFileId && draggedFileId !== fileId) {
      setDropTargetId(fileId);
    }
  };

  const handleDragLeave = () => {
    setDropTargetId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFileId: string) => {
    e.preventDefault();
    if (!draggedFileId || draggedFileId === targetFileId) return;

    try {
      await computeDiff(targetFileId, draggedFileId);
      console.log('Diff computed successfully');
    } catch (error) {
      console.error('Failed to compute diff:', error);
    } finally {
      setDraggedFileId(null);
      setDropTargetId(null);
    }
  };

  const handleCreateBranch = async (parentId: string) => {
    try {
      const branchId = await createBranch(parentId);
      setActiveFile(branchId);
    } catch (error) {
      console.error('Failed to create branch:', error);
    }
  };

  const isBranch = (file: MapFile | ScenarioBranch): file is ScenarioBranch => {
    return 'branchId' in file;
  };

  const mapFiles = Array.from(files.values()).filter(f => !isBranch(f));
  const branches = Array.from(files.values()).filter(f => isBranch(f)) as ScenarioBranch[];

  return (
    <div className="h-full flex flex-col bg-[#F5F5F5] border-r border-[#CBD5E1]">
      <div className="p-3 border-b border-[#CBD5E1]">
        <h3 className="text-xs font-medium text-gray-700 mb-2">MAP FILE SYSTEM</h3>
        <label className="block">
          <input
            type="file"
            accept=".map,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <span className="text-xs px-2 py-1 bg-white border border-[#CBD5E1] rounded cursor-pointer hover:bg-gray-50">
            Upload .map File
          </span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {mapFiles.map((file) => {
          const isActive = activeFileId === file.sessionId;
          const isDropTarget = dropTargetId === file.sessionId;
          const fileBranches = branches.filter(b => b.parentMapId === file.sessionId);

          return (
            <div key={file.sessionId} className="mb-1">
              <div
                draggable
                onDragStart={() => handleDragStart(file.sessionId)}
                onDragOver={(e) => handleDragOver(e, file.sessionId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, file.sessionId)}
                onClick={() => setActiveFile(file.sessionId)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleCreateBranch(file.sessionId);
                }}
                className={`
                  px-2 py-1 text-xs rounded cursor-pointer flex items-center gap-2
                  ${isActive ? 'bg-white' : 'hover:bg-white/50'}
                  ${isDropTarget ? 'ring-2 ring-blue-400' : ''}
                `}
              >
                <span>📄</span>
                <span className="flex-1 truncate font-mono">{file.sessionId}</span>
              </div>

              {fileBranches.length > 0 && (
                <div className="ml-4 mt-1">
                  {fileBranches.map((branch) => (
                    <div
                      key={branch.branchId}
                      onClick={() => setActiveFile(branch.branchId)}
                      className={`
                        px-2 py-1 text-xs rounded cursor-pointer flex items-center gap-2
                        ${activeFileId === branch.branchId ? 'bg-white' : 'hover:bg-white/50'}
                      `}
                    >
                      <span>🌿</span>
                      <span className="flex-1 truncate font-mono text-gray-600">
                        {branch.branchName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {mapFiles.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-4">
            No map files loaded
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[#CBD5E1] text-xs text-gray-500">
        <div>Files: {mapFiles.length}/{20}</div>
        <div className="text-[10px] mt-1">
          Drag file onto another to compare
          <br />
          Right-click to create branch
        </div>
      </div>
    </div>
  );
}
