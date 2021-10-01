import hre from "hardhat";
import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";

import { Vault, StrategyEllipsis3Pool } from "../typechain";
import { config } from "./configs/bsc";
const outputFilePath = `./deployments/${hre.network.name}.json`;

async function main() {
  const deployments = JSON.parse(readFileSync(outputFilePath, "utf-8"));

  const [deployer] = await ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);

  const deployerTxCount = await deployer.getTransactionCount("latest");
  const stratAddr = ethers.utils.getContractAddress({ from: deployer.address, nonce: deployerTxCount + 1 });

  const gasPriceAddr = deployments["GasPrice"];

  // Vault
  const Vault = await hre.ethers.getContractFactory("Vault");
  const vault: Vault = await Vault.deploy(stratAddr, config.name, config.symbol, config.approvalDelay);
  console.log(`Vault Deployed: ${vault.address}`);
  await vault.deployed();

  // Strategy
  const StrategyEllipsis3Pool = await hre.ethers.getContractFactory("StrategyEllipsis3Pool");
  const strategy: StrategyEllipsis3Pool = await StrategyEllipsis3Pool.deploy(
    vault.address,
    config.unirouter,
    deployer.address,
    deployer.address,
    deployer.address,
    gasPriceAddr,
  );
  console.log(`Strategy Deployed: ${strategy.address}`);
  await strategy.deployed();

  if (!deployments["Vaults"]) deployments["Vaults"] = [];
  deployments["Vaults"].push({
    [config.name]: {
      vault: vault.address,
      strategy: strategy.address,
    },
  });

  // Save constructor arguments
  deployments["Constructors"][vault.address] = Vault.interface.encodeDeploy([
    stratAddr,
    config.name,
    config.symbol,
    config.approvalDelay,
  ]);
  deployments["Constructors"][strategy.address] = StrategyEllipsis3Pool.interface.encodeDeploy([
    vault.address,
    config.unirouter,
    deployer.address,
    deployer.address,
    deployer.address,
    gasPriceAddr,
  ]);
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));

  // Update parameters
  console.log("Calling setHarvestOnDeposit");
  let tx = await strategy.setHarvestOnDeposit(true);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Calling setStrategist");
  tx = await strategy.setStrategist(config.admin);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Calling setPlatformFeeRecipient");
  tx = await strategy.setPlatformFeeRecipient(config.admin);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Calling setKeeper");
  tx = await strategy.setKeeper(config.admin);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Calling transferOwnership");
  tx = await strategy.transferOwnership(config.admin);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Calling transferOwnership on Vault");
  tx = await vault.transferOwnership(config.admin);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
