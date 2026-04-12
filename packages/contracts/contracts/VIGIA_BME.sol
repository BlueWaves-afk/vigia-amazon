// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract VIGIA_BME is ERC20, Ownable {
    using ECDSA for bytes32;

    address public kmsSigner;
    address public treasury;

    mapping(address => uint256) public claimedNonce;
    mapping(address => uint256) public dataCredits;

    event RewardClaimed(address indexed wallet, uint256 amount, uint256 nonce);
    event DataCreditsPurchased(address indexed enterprise, uint256 amount);

    constructor(address _kmsSigner) ERC20("VIGIA", "VGA") Ownable(msg.sender) {
        kmsSigner = _kmsSigner;
        treasury = _kmsSigner;
        _mint(_kmsSigner, 1_000_000 * 10 ** 18);
    }

    function claimRewards(uint256 amount, uint256 nonce, bytes calldata signature) external {
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
