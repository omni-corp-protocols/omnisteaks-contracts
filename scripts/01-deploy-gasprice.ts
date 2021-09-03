import hre from "hardhat";
import { readFileSync, writeFileSync } from "fs";

const outputFilePath = `./deployments/${hre.network.name}.json`;

async function main() {
  console.log("Started");
  const GasPrice = await hre.ethers.getContractFactory("GasPrice");
  const gasPrice = await GasPrice.deploy();
  await gasPrice.deployed();
  console.log("GasPrice deployed to:", gasPrice.address);

  const output = JSON.parse(readFileSync(outputFilePath, "utf-8"));
  output.GasPrice = gasPrice.address;
  writeFileSync(outputFilePath, JSON.stringify(output, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
