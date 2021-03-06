import { ethers } from "hardhat";
import { config } from "./configs/metis";
import { StratManager__factory, Vault__factory } from "../typechain";

const Vault_Addr = "0x34F88c1137E6986c7eb864054688311960C2b12b";

async function main() {
  const [account] = await ethers.getSigners();

  const vault = Vault__factory.connect(Vault_Addr, account);
  const stratAddr = await vault.strategy();

  const strategyExtraI = new ethers.Contract(stratAddr, StratExtraAbi, account);
  //Set true for single token autocompounding 
  // console.log("Calling setHarvestOnDeposit");
  // let tx = await strategyExtraI.setHarvestOnDeposit(true, { gasLimit: 200000 });
  // console.log(`Tx: ${tx.hash}`);
  // await tx.wait();

  console.log("Calling setTotalHarvestFee - 10% For Strategy :>>>>", stratAddr);
  let tx = await strategyExtraI.setTotalHarvestFee(1000);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Calling setCallFee - 0% For Strategy :>>>>", stratAddr);
  tx = await strategyExtraI.setCallFee(0);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  const stratManager = StratManager__factory.connect(stratAddr, account);

  console.log("Calling setStrategist");
  tx = await stratManager.setStrategist(config.admin);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Calling setPlatformFeeRecipient");
  tx = await stratManager.setPlatformFeeRecipient(config.feeWallet);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Calling setKeeper");
  tx = await stratManager.setKeeper(config.admin);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Calling transferOwnership");
  tx = await stratManager.transferOwnership(config.admin);
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

const StratExtraAbi = [
  {
    inputs: [
      {
        internalType: "bool",
        name: "_harvestOnDeposit",
        type: "bool",
      },
    ],
    name: "setHarvestOnDeposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_fee",
        type: "uint256",
      },
    ],
    name: "setCallFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_fee",
        type: "uint256",
      },
    ],
    name: "setTotalHarvestFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];
