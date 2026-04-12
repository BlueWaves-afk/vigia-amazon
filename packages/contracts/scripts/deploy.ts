import { ethers } from "hardhat";

const KMS_SIGNER = "0x4588a66b967ed8CFad952Ca557160A338f6115BF";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "POL");

  const Factory = await ethers.getContractFactory("VIGIA_BME");
  const contract = await Factory.deploy(KMS_SIGNER, {
    maxFeePerGas: ethers.parseUnits("30", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
  });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ VIGIA_BME deployed to:", address);
  console.log("KMS signer (treasury):", KMS_SIGNER);
  console.log("\nNext step — update Lambda env var:");
  console.log(`VIGIA_CONTRACT_ADDRESS=${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
