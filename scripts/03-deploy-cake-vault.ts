import hre from "hardhat";
import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";

import { Vault, StrategyCakeV2 } from "../typechain";
import { config } from "./configs/bsc";
const outputFilePath = `./deployments/${hre.network.name}.json`;

// Constructor params
const PARAMS = {
  approvalDelay: config.approvalDelay,
  name: config.name,
  symbol: config.symbol,
  unirouter: config.unirouter,
};

async function main() {
  const deployments = JSON.parse(readFileSync(outputFilePath, "utf-8"));

  const [deployer] = await ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);

  const deployerTxCount = await deployer.getTransactionCount("latest");
  const stratAddr = ethers.utils.getContractAddress({ from: deployer.address, nonce: deployerTxCount + 1 });
  const gasPriceAddr = deployments["GasPrice"];
  // Vault
  const Vault = await hre.ethers.getContractFactory("Vault");
  const vault: Vault = await Vault.deploy(stratAddr, PARAMS.name, PARAMS.symbol, PARAMS.approvalDelay);
  console.log(`Vault Deployed: ${vault.address}`);
  await vault.deployed();

  // Strategy
  const StrategyCakeV2 = await hre.ethers.getContractFactory("StrategyCakeV2");
  const strategy: StrategyCakeV2 = await StrategyCakeV2.deploy(
    vault.address,
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
      vault: vault.address,
      strategy: strategy.address,
    },
  });

  // Save constructor arguments
  deployments["Constructors"][vault.address] = Vault.interface.encodeDeploy([
    stratAddr,
    PARAMS.name,
    PARAMS.symbol,
    PARAMS.approvalDelay,
  ]);
  deployments["Constructors"][strategy.address] = StrategyCakeV2.interface.encodeDeploy([
    vault.address,
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
