import hre from "hardhat";
import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";

import { SteakVault, StrategyCakeV2 } from "../typechain";
import { config } from "./configs/bsc";
const outputFilePath = `./deployments/${hre.network.name}.json`;

// Constructor params
const PARAMS = {
  approvalDelay: config.approvalDelay,
  name: "Steak Cake",
  symbol: "steakCake",
  unirouter: config.unirouter,
};

async function main() {
  const deployments = JSON.parse(readFileSync(outputFilePath, "utf-8"));

  const [deployer] = await ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);

  const deployerTxCount = await deployer.getTransactionCount("latest");
  const stratAddr = ethers.utils.getContractAddress({ from: deployer.address, nonce: deployerTxCount + 1 });

  // Vault
  const SteakVault = await hre.ethers.getContractFactory("SteakVault");
  const steakVault: SteakVault = await SteakVault.deploy(stratAddr, PARAMS.name, PARAMS.symbol, PARAMS.approvalDelay);
  console.log(`Vault Deployed: ${steakVault.address}`);
  await steakVault.deployed();

  // Strategy
  const StrategyCakeV2 = await hre.ethers.getContractFactory("StrategyCakeV2");
  const strategy: StrategyCakeV2 = await StrategyCakeV2.deploy(
    steakVault.address,
    PARAMS.unirouter,
    deployer.address,
    deployer.address,
    deployer.address,
  );
  console.log(`Strategy Deployed: ${strategy.address}`);
  await strategy.deployed();

  if (!deployments["Vaults"]) deployments["Vaults"] = [];
  deployments["Vaults"].push({
    [PARAMS.name]: {
      vault: steakVault.address,
      strategy: strategy.address,
    },
  });

  // Save constructor arguments
  deployments["Constructors"][steakVault.address] = SteakVault.interface.encodeDeploy([
    stratAddr,
    PARAMS.name,
    PARAMS.symbol,
    PARAMS.approvalDelay,
  ]);
  deployments["Constructors"][strategy.address] = StrategyCakeV2.interface.encodeDeploy([
    steakVault.address,
    PARAMS.unirouter,
    deployer.address,
    deployer.address,
    deployer.address,
  ]);
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
