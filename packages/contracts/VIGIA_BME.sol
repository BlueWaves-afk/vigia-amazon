// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract VIGIA_BME is ERC20, Ownable {
    using ECDSA for bytes32;

    address public kmsSigner;
    address public treasury;

    uint256 public constant MIN_STAKE = 10 * 10 ** 18; // 10 VGA minimum stake

    mapping(address => uint256) public claimedNonce;
    mapping(address => uint256) public dataCredits;
    mapping(address => uint256) public stakedBalance;
    mapping(address => bool)    public blacklisted;
    mapping(address => uint256) public stakeTimestamp; // for unstake time-lock (24h)

    event RewardClaimed(address indexed wallet, uint256 amount, uint256 nonce);
    event DataCreditsPurchased(address indexed enterprise, uint256 amount);
    event NodeStaked(address indexed node, uint256 amount);
    event NodeUnstaked(address indexed node, uint256 amount);
    event NodeSlashed(address indexed node, uint256 slashedAmount, bytes32 hazardId);

    constructor(address _kmsSigner) ERC20("VIGIA", "VGA") Ownable(msg.sender) {
        kmsSigner = _kmsSigner;
        treasury = _kmsSigner;
        _mint(_kmsSigner, 1_000_000 * 10 ** 18);
    }

    // ── Staking ───────────────────────────────────────────────────────────────

    function stake(uint256 amount) external {
        require(!blacklisted[msg.sender], "Node is blacklisted");
        require(amount >= MIN_STAKE, "Below minimum stake");
        _transfer(msg.sender, address(this), amount);
        stakedBalance[msg.sender] += amount;
        stakeTimestamp[msg.sender] = block.timestamp;
        emit NodeStaked(msg.sender, amount);
    }

    function unstake() external {
        require(!blacklisted[msg.sender], "Node is blacklisted");
        uint256 amount = stakedBalance[msg.sender];
        require(amount > 0, "Nothing staked");
        require(block.timestamp >= stakeTimestamp[msg.sender] + 24 hours, "Stake locked for 24h");
        stakedBalance[msg.sender] = 0;
        _transfer(address(this), msg.sender, amount);
        emit NodeUnstaked(msg.sender, amount);
    }

    // ── Slashing (KMS-authorized only) ───────────────────────────────────────

    function slash(address node, bytes32 hazardId, bytes calldata signature) external {
        // KMS signs: keccak256(node, hazardId, chainId)
        bytes32 hash = keccak256(abi.encodePacked(node, hazardId, block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        address recovered = ethHash.recover(signature);
        require(recovered == kmsSigner, "Invalid KMS signature");

        uint256 slashAmount = stakedBalance[node];
        stakedBalance[node] = 0;
        blacklisted[node] = true;

        if (slashAmount > 0) {
            // Burn the stake — permanently removes from supply (deflationary)
            _burn(address(this), slashAmount);
        }

        emit NodeSlashed(node, slashAmount, hazardId);
    }

    // ── Rewards ───────────────────────────────────────────────────────────────

    function claimRewards(uint256 amount, uint256 nonce, bytes calldata signature) external {
        require(!blacklisted[msg.sender], "Node is blacklisted");
        require(stakedBalance[msg.sender] >= MIN_STAKE, "Must stake before claiming");
        require(nonce == claimedNonce[msg.sender], "Invalid nonce");

        bytes32 hash = keccak256(abi.encodePacked(msg.sender, amount, nonce, block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        address recovered = ethHash.recover(signature);
        require(recovered == kmsSigner, "Invalid signature");

        claimedNonce[msg.sender]++;
        _transfer(treasury, msg.sender, amount);
        emit RewardClaimed(msg.sender, amount, nonce);
    }

    function burnForDataCredits(uint256 amount) external {
        _burn(msg.sender, amount);
        dataCredits[msg.sender] += amount;
        emit DataCreditsPurchased(msg.sender, amount);
    }

    function setKmsSigner(address newSigner) external onlyOwner {
        kmsSigner = newSigner;
    }
}
