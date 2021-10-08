import hre from "hardhat";
import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";

import { Vault, StrategyChefCurveLP } from "../typechain";
import { config } from "./configs/arbitrum";
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
  const Strategy = await hre.ethers.getContractFactory("StrategyChefCurveLP");
  const strategy: StrategyChefCurveLP = await Strategy.deploy(
    config.wantToken,
    config.poolId,
    config.chef,
    config.pool,
    config.poolSize,
    config.depositIndex,
    config.outputToNativeRoute,
    config.nativeToDepositRoute,
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
  deployments["Constructors"][strategy.address] = Strategy.interface.encodeDeploy([
    config.wantToken,
    config.poolId,
    config.chef,
    config.pool,
    config.poolSize,
    config.depositIndex,
    config.outputToNativeRoute,
    config.nativeToDepositRoute,
    vault.address,
    config.unirouter,
    deployer.address,
    deployer.address,
    deployer.address,
    gasPriceAddr,
  ]);
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
