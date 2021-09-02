import { BigNumber } from "bignumber.js";
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN });

export const toBn = (num: BigNumber.Value): BigNumber => {
  return new BigNumber(num.toString());
};

export const toBnFixed = (num: BigNumber.Value): string => {
  return toBn(num).toFixed();
};
