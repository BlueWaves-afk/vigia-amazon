# VIGIA Smart Contract Specification — BME Upgrade

## Contract: `VIGIA_BME.sol`

**Inherits**: `ERC20`, `Ownable`  
**Network**: Polygon Amoy (chainId: 80002)  
**Treasury**: AWS KMS wallet — holds full supply, never submits txs

---

## State Variables

```solidity
address public kmsSigner;          // AWS KMS wallet — the only valid claim authorizer
mapping(address => uint256) public claimedNonce;  // replay protection per wallet
mapping(address => uint256) public dataCredits;   // enterprise credit balances
```

---

## Function 1: `claimRewards(uint256 amount, uint256 nonce, bytes calldata signature)`

**Called by**: User/driver (user pays gas)

**Logic**:
1. Verify `nonce == claimedNonce[msg.sender]` (replay protection)
2. Reconstruct message hash:
   ```solidity
   bytes32 hash = keccak256(abi.encodePacked(msg.sender, amount, nonce, block.chainid));
   bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
   ```
3. Recover signer from `signature` using `ECDSA.recover(ethHash, signature)`
4. Require `recoveredSigner == kmsSigner`
5. Increment `claimedNonce[msg.sender]`
6. `_transfer(treasury, msg.sender, amount)` — Treasury → User

**Reverts if**: invalid signature, wrong nonce, insufficient treasury balance.

---

## Function 2: `burnForDataCredits(uint256 amount)`

**Called by**: Enterprise (enterprise pays gas)

**Logic**:
1. `_burn(msg.sender, amount)` — permanently removes tokens from supply
2. `dataCredits[msg.sender] += amount` — 1 token = 1 Data Credit
3. Emit `DataCreditsPurchased(msg.sender, amount)`

---

## Function 3: `setKmsSigner(address newSigner)` — `onlyOwner`

Allows rotating the KMS key without redeploying.

---

## Events

```solidity
event RewardClaimed(address indexed wallet, uint256 amount, uint256 nonce);
event DataCreditsPurchased(address indexed enterprise, uint256 amount);
```

---

## Deployment Notes

- Deploy with `kmsSigner = 0x4588a66b967ed8CFad952Ca557160A338f6115BF`
- Mint full supply (1,000,000 × 10^18) to Treasury in constructor
- Treasury address = KMS wallet (same address)
- Update `VIGIA_CONTRACT_ADDRESS` in Lambda env after deployment

---

## Security Properties

| Property | Mechanism |
|---|---|
| Only KMS can authorize claims | `ECDSA.recover` must return `kmsSigner` |
| No double-claim | `claimedNonce` increments per claim |
| No replay across chains | `block.chainid` in message hash |
| Burn is irreversible | `_burn` reduces `totalSupply` permanently |
