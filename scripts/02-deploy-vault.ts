import hre from "hardhat";
import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";

import { SteakVault, StrategyOmnifarmLP } from "../typechain";
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
  const SteakVault = await hre.ethers.getContractFactory("SteakVault");
  const steakVault: SteakVault = await SteakVault.deploy(stratAddr, config.name, config.symbol, config.approvalDelay);
  console.log(`Vault Deployed: ${steakVault.address}`);
  await steakVault.deployed();

  // Strategy
  const StrategyOmnifarmLP = await hre.ethers.getContractFactory("StrategyOmnifarmLP");
  const strategy: StrategyOmnifarmLP = await StrategyOmnifarmLP.deploy(
    config.wantToken,
    config.pool,
    steakVault.address,
    config.unirouter,
    deployer.address,
    deployer.address,
    deployer.address,
    gasPriceAddr,
    config.outputToNativeRoute,
    config.outputToLp0Route,
    config.outputToLp1Route,
  );
  console.log(`Strategy Deployed: ${strategy.address}`);
  await strategy.deployed();

  if (!deployments["Vaults"]) deployments["Vaults"] = [];
  deployments["Vaults"].push({
    [config.name]: {
      vault: steakVault.address,
      strategy: strategy.address,
    },
  });

  // Save constructor arguments
  deployments["Constructors"][steakVault.address] = SteakVault.interface.encodeDeploy([
    stratAddr,
    config.name,
    config.symbol,
    config.approvalDelay,
  ]);
  deployments["Constructors"][strategy.address] = StrategyOmnifarmLP.interface.encodeDeploy([
    config.wantToken,
    config.pool,
    steakVault.address,
    config.unirouter,
    deployer.address,
    deployer.address,
    deployer.address,
    gasPriceAddr,
    config.outputToNativeRoute,
    config.outputToLp0Route,
    config.outputToLp1Route,
  ]);
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
