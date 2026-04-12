'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, File, GitBranch, Folder } from 'lucide-react';
import { useMapFileStore } from '@/stores/mapFileStore';
import type { MapFile } from '@/types/shared';

const C = {
  bg: 'var(--c-bg)',
  panel: 'var(--c-panel)',
  hover: 'var(--c-hover)',
  border: 'var(--c-border)',
  text: 'var(--c-text)',
  textSec: 'var(--c-text-dim)',
  textMut: 'var(--c-text-muted)',
};

export function MapFileExplorerHierarchical() {
  const { files, activeFileId, setActiveFile, loadFiles, getHierarchy } = useMapFileStore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [hierarchy, setHierarchy] = useState<Record<string, Record<string, Record<string, MapFile[]>>>>({});

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    setHierarchy(getHierarchy());
  }, [files, getHierarchy]);

  const toggleNode = (path: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const isExpanded = (path: string) => expandedNodes.has(path);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.panel, borderRight: `1px solid ${C.border}` }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: '0.75rem', fontWeight: 600, color: C.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Map Files
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {Object.keys(hierarchy).length === 0 ? (
          <div style={{ padding: '16px', fontSize: '0.85rem', color: C.textMut, textAlign: 'center' }}>
            No sessions yet
          </div>
        ) : (
          Object.entries(hierarchy).map(([country, states]) => (
            <div key={country}>
              {/* Country Level */}
              <div
                onClick={() => toggleNode(country)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.85rem', color: C.text }}
              >
                {isExpanded(country) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={14} />
                <span>{country}</span>
              </div>

              {/* State Level */}
              {isExpanded(country) && Object.entries(states).map(([state, cities]) => (
                <div key={`${country}-${state}`}>
                  <div
                    onClick={() => toggleNode(`${country}-${state}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', paddingLeft: 32, cursor: 'pointer', fontSize: '0.85rem', color: C.text }}
                  >
                    {isExpanded(`${country}-${state}`) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Folder size={14} />
                    <span>{state}</span>
                  </div>

                  {/* City Level */}
                  {isExpanded(`${country}-${state}`) && Object.entries(cities).map(([city, cityFiles]) => (
                    <div key={`${country}-${state}-${city}`}>
                      <div
                        onClick={() => toggleNode(`${country}-${state}-${city}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', paddingLeft: 48, cursor: 'pointer', fontSize: '0.85rem', color: C.text }}
                      >
                        {isExpanded(`${country}-${state}-${city}`) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Folder size={14} />
                        <span>{city}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: C.textMut }}>({cityFiles.length})</span>
                      </div>

                      {/* Files */}
                      {isExpanded(`${country}-${state}-${city}`) && cityFiles.map(file => {
                        const isActive = activeFileId === file.sessionId;
                        return (
                          <div
                            key={file.sessionId}
                            onClick={() => setActiveFile(file.sessionId)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 16px',
                              paddingLeft: 64,
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              color: isActive ? C.text : C.textSec,
                              background: isActive ? C.hover : 'transparent',
                            }}
                          >
                            <File size={14} />
                            <span style={{ flex: 1 }}>{file.displayName}</span>
                            <span style={{ fontSize: '0.7rem', color: C.textMut }}>
                              {file.temporal.status === 'collecting' ? 'LIVE' : 'OK'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
