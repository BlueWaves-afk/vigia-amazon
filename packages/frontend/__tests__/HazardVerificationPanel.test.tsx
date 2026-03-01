import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HazardVerificationPanel } from '../app/components/HazardVerificationPanel';

// Mock fetch globally
global.fetch = vi.fn();

describe('HazardVerificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should display empty state when no hazards detected', () => {
    render(<HazardVerificationPanel />);
    
    expect(screen.getByText('No hazards detected yet')).toBeInTheDocument();
    expect(screen.getByText('Upload dashcam footage to start detection')).toBeInTheDocument();
  });

  it('should add hazard to list when hazard-detected event is emitted', async () => {
    render(<HazardVerificationPanel />);
    
    // Emit hazard detection event
    const hazardEvent = new CustomEvent('hazard-detected', {
      detail: {
        type: 'POTHOLE',
        lat: 22.2604,
        lon: 84.8536,
        confidence: 0.85,
        timestamp: new Date().toISOString(),
      }
    });
    
    window.dispatchEvent(hazardEvent);
    
    await waitFor(() => {
      expect(screen.getByText('POTHOLE')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
  });

  it('should transition hazard from pending to unverified when telemetry is submitted', async () => {
    render(<HazardVerificationPanel />);
    
    // Emit hazard detection
    const hazardId = 'POTHOLE-2026-03-01T14:00:00.000Z';
    window.dispatchEvent(new CustomEvent('hazard-detected', {
      detail: {
        type: 'POTHOLE',
        lat: 22.2604,
        lon: 84.8536,
        confidence: 0.85,
        timestamp: '2026-03-01T14:00:00.000Z',
      }
    }));
    
    await waitFor(() => {
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
    
    // Emit telemetry submission
    window.dispatchEvent(new CustomEvent('telemetry-submitted', {
      detail: { hazardIds: [hazardId] }
    }));
    
    await waitFor(() => {
      expect(screen.getByText('UNVERIFIED')).toBeInTheDocument();
    });
  });

  it('should poll agent trace API after telemetry submission', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    render(<HazardVerificationPanel />);
    
    // Emit hazard detection
    const hazardId = 'POTHOLE-2026-03-01T14:00:00.000Z';
    window.dispatchEvent(new CustomEvent('hazard-detected', {
      detail: {
        type: 'POTHOLE',
        lat: 22.2604,
        lon: 84.8536,
        confidence: 0.85,
        timestamp: '2026-03-01T14:00:00.000Z',
      }
    }));
    
    await waitFor(() => {
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
    
    // Emit telemetry submission
    window.dispatchEvent(new CustomEvent('telemetry-submitted', {
      detail: { hazardIds: [hazardId] }
    }));
    
    await waitFor(() => {
      expect(screen.getByText('VERIFYING')).toBeInTheDocument();
    });
    
    // Verify API was called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/traces/${hazardId}`)
      );
    });
  });

  it('should mark hazard as verified when agent returns high score', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        trace: {
          traceId: 'trace-123',
          reasoning: 'Verified pothole with high confidence',
          verificationScore: 85,
        }
      })
    });
    global.fetch = mockFetch;
    
    render(<HazardVerificationPanel />);
    
    // Emit hazard detection
    const hazardId = 'POTHOLE-2026-03-01T14:00:00.000Z';
    window.dispatchEvent(new CustomEvent('hazard-detected', {
      detail: {
        type: 'POTHOLE',
        lat: 22.2604,
        lon: 84.8536,
        confidence: 0.85,
        timestamp: '2026-03-01T14:00:00.000Z',
      }
    }));
    
    // Emit telemetry submission
    window.dispatchEvent(new CustomEvent('telemetry-submitted', {
      detail: { hazardIds: [hazardId] }
    }));
    
    await waitFor(() => {
      expect(screen.getByText('VERIFYING')).toBeInTheDocument();
    });
    
    // Wait for API response
    await waitFor(() => {
      expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should mark hazard as rejected when agent returns low score', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        trace: {
          traceId: 'trace-123',
          reasoning: 'Low confidence detection, likely false positive',
          verificationScore: 45,
        }
      })
    });
    global.fetch = mockFetch;
    
    render(<HazardVerificationPanel />);
    
    // Emit hazard detection
    const hazardId = 'POTHOLE-2026-03-01T14:00:00.000Z';
    window.dispatchEvent(new CustomEvent('hazard-detected', {
      detail: {
        type: 'POTHOLE',
        lat: 22.2604,
        lon: 84.8536,
        confidence: 0.85,
        timestamp: '2026-03-01T14:00:00.000Z',
      }
    }));
    
    // Emit telemetry submission
    window.dispatchEvent(new CustomEvent('telemetry-submitted', {
      detail: { hazardIds: [hazardId] }
    }));
    
    await waitFor(() => {
      expect(screen.getByText('VERIFYING')).toBeInTheDocument();
    });
    
    // Wait for API response
    await waitFor(() => {
      expect(screen.getByText('REJECTED')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should retry polling if agent trace is not ready', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        // First 2 calls return 404 (not ready)
        return Promise.resolve({ ok: false, status: 404 });
      }
      // Third call returns trace
      return Promise.resolve({
        ok: true,
        json: async () => ({
          trace: {
            traceId: 'trace-123',
            reasoning: 'Verified after delay',
            verificationScore: 80,
          }
        })
      });
    });
    global.fetch = mockFetch;
    
    render(<HazardVerificationPanel />);
    
    // Emit hazard detection
    const hazardId = 'POTHOLE-2026-03-01T14:00:00.000Z';
    window.dispatchEvent(new CustomEvent('hazard-detected', {
      detail: {
        type: 'POTHOLE',
        lat: 22.2604,
        lon: 84.8536,
        confidence: 0.85,
        timestamp: '2026-03-01T14:00:00.000Z',
      }
    }));
    
    // Emit telemetry submission
    window.dispatchEvent(new CustomEvent('telemetry-submitted', {
      detail: { hazardIds: [hazardId] }
    }));
    
    // Fast-forward through polling intervals
    await vi.advanceTimersByTimeAsync(15000); // 3 polls at 5s intervals
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    });
  });

  it('should display agent reasoning when hazard is expanded', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        trace: {
          traceId: 'trace-123',
          reasoning: 'Detected clear pothole with visible damage to road surface',
          verificationScore: 85,
        }
      })
    });
    global.fetch = mockFetch;
    
    const { container } = render(<HazardVerificationPanel />);
    
    // Emit hazard detection
    const hazardId = 'POTHOLE-2026-03-01T14:00:00.000Z';
    window.dispatchEvent(new CustomEvent('hazard-detected', {
      detail: {
        type: 'POTHOLE',
        lat: 22.2604,
        lon: 84.8536,
        confidence: 0.85,
        timestamp: '2026-03-01T14:00:00.000Z',
      }
    }));
    
    // Emit telemetry submission
    window.dispatchEvent(new CustomEvent('telemetry-submitted', {
      detail: { hazardIds: [hazardId] }
    }));
    
    // Wait for verification
    await waitFor(() => {
      expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Click to expand
    const hazardButton = screen.getByText('POTHOLE').closest('button');
    hazardButton?.click();
    
    await waitFor(() => {
      expect(screen.getByText('Agent Reasoning:')).toBeInTheDocument();
      expect(screen.getByText(/Detected clear pothole/)).toBeInTheDocument();
    });
  });

  it('should update footer stats correctly', async () => {
    render(<HazardVerificationPanel />);
    
    // Emit 3 hazards
    for (let i = 0; i < 3; i++) {
      window.dispatchEvent(new CustomEvent('hazard-detected', {
        detail: {
          type: 'POTHOLE',
          lat: 22.2604 + i * 0.001,
          lon: 84.8536 + i * 0.001,
          confidence: 0.85,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        }
      }));
    }
    
    await waitFor(() => {
      const pendingCount = screen.getAllByText('PENDING').length;
      expect(pendingCount).toBe(3);
    });
    
    // Check footer stats
    const footerStats = screen.getAllByText('3');
    expect(footerStats.length).toBeGreaterThan(0);
  });

  it('should handle API errors gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<HazardVerificationPanel />);
    
    // Emit hazard detection
    const hazardId = 'POTHOLE-2026-03-01T14:00:00.000Z';
    window.dispatchEvent(new CustomEvent('hazard-detected', {
      detail: {
        type: 'POTHOLE',
        lat: 22.2604,
        lon: 84.8536,
        confidence: 0.85,
        timestamp: '2026-03-01T14:00:00.000Z',
      }
    }));
    
    // Emit telemetry submission
    window.dispatchEvent(new CustomEvent('telemetry-submitted', {
      detail: { hazardIds: [hazardId] }
    }));
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch agent trace:',
        expect.any(Error)
      );
    });
    
    consoleSpy.mockRestore();
  });
});
