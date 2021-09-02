import { BigNumber } from "bignumber.js";
import { toBn } from "./bn";

export const weiToNum = (amount: string | number | BigNumber, decimals: string | number | BigNumber): string => {
  const amt = toBn(amount);
  const dec = toBn(decimals);
  const ten = toBn(10);

  const result = amt.div(ten.pow(dec));
  return result.toFixed();
};

export const numToWei = (amount: string | number | BigNumber, decimals: string | number | BigNumber): string => {
  const amt = toBn(amount);
  const dec = toBn(decimals);
  const ten = toBn(10);

  const result = amt.times(ten.pow(dec));
  return result.toFixed(0, 1); // rounding mode: Round_down
};
