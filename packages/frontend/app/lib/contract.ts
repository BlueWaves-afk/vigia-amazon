import { VIGIA_CONTRACT_ADDRESS, POLYGON_AMOY_RPC, CHAIN_ID_HEX } from './constants';

const CLAIM_ABI = [
  'function claimRewards(uint256 amount, uint256 nonce, bytes calldata signature) external',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function burnForDataCredits(uint256 amount) external',
  'function dataCredits(address) view returns (uint256)',
];

/** Read totalSupply from contract via public RPC — no wallet needed */
export async function readTotalSupply(): Promise<bigint> {
  const res = await fetch(POLYGON_AMOY_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_call',
      params: [{ to: VIGIA_CONTRACT_ADDRESS, data: '0x18160ddd' }, 'latest'],
    }),
  });
  const { result } = await res.json();
  return BigInt(result);
}

/** Read dataCredits(address) from contract via public RPC */
export async function readDataCredits(address: string): Promise<bigint> {
  const padded = address.slice(2).padStart(64, '0');
  const res = await fetch(POLYGON_AMOY_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_call',
      params: [{ to: VIGIA_CONTRACT_ADDRESS, data: '0x981b24d0' + padded }, 'latest'],
    }),
  });
  const { result } = await res.json();
  return BigInt(result);
}

/** Switch MetaMask to Polygon Amoy */
async function ensureAmoy() {
  await (window as any).ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: CHAIN_ID_HEX }],
  }).catch(() =>
    (window as any).ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX, chainName: 'Polygon Amoy', rpcUrls: [POLYGON_AMOY_RPC], nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 } }],
    })
  );
}

/** Call claimRewards via window.ethereum — user pays gas */
export async function claimRewards(amount: string, nonce: number, signature: string): Promise<string> {
  await ensureAmoy();
  const { ethers } = await import('ethers');
  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(VIGIA_CONTRACT_ADDRESS, CLAIM_ABI, signer);
  const tx = await contract.claimRewards(BigInt(amount), nonce, signature);
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Call burnForDataCredits via window.ethereum */
export async function burnForDataCredits(amount: bigint): Promise<string> {
  await ensureAmoy();
  const { ethers } = await import('ethers');
  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(VIGIA_CONTRACT_ADDRESS, CLAIM_ABI, signer);
  const tx = await contract.burnForDataCredits(amount);
  const receipt = await tx.wait();
  return receipt.hash;
}
