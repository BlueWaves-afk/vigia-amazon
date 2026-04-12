'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const STORAGE_KEY = 'vigia_device_pk';
const TELEMETRY_API = process.env.NEXT_PUBLIC_TELEMETRY_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

export type DeviceWalletStatus = 'loading' | 'ready' | 'error';

export interface DeviceWallet {
  address: string;
  signPayload: (payloadStr: string) => Promise<string>;
  status: DeviceWalletStatus;
}

export function useDeviceWallet(): DeviceWallet {
  const [address, setAddress]   = useState('');
  const [wallet,  setWallet]    = useState<ethers.Wallet | ethers.HDNodeWallet | null>(null);
  const [status,  setStatus]    = useState<DeviceWalletStatus>('loading');

  useEffect(() => {
    (async () => {
      try {
        let pk = localStorage.getItem(STORAGE_KEY);
        let w: ethers.Wallet | ethers.HDNodeWallet;

        if (pk) {
          w = new ethers.Wallet(pk);
        } else {
          w = ethers.Wallet.createRandom();
          localStorage.setItem(STORAGE_KEY, w.privateKey);
        }

        // Always attempt registration — idempotent (returns 200 if already registered).
        // This self-heals devices that were generated before the registry existed.
        if (TELEMETRY_API) {
          fetch(`${TELEMETRY_API}/register-device`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_address: w.address }),
          }).catch(e => console.warn('[useDeviceWallet] Registration failed:', e));
        }

        setWallet(w);
        setAddress(w.address);
        setStatus('ready');
      } catch (e) {
        console.error('[useDeviceWallet] Init error:', e);
        setStatus('error');
      }
    })();
  }, []);

  const signPayload = async (payloadStr: string): Promise<string> => {
    if (!wallet) throw new Error('Wallet not initialised');
    return wallet.signMessage(payloadStr);
  };

  return { address, signPayload, status };
}
