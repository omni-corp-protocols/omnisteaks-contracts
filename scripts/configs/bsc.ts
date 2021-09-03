// module.exports = {
//   approvalDelay: "14400",   // in seconds
// };

export const config = {
  approvalDelay: "14400", // in seconds
  name: "Test Token",
  symbol: "TTK",
  wantToken: "0x8518D5906A6C72b0157d55caFf239dc43c19AbF6",
  pool: "0x194bB6Cc4dD075DB371858ff534118DAFe538372",
  unirouter: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  outputToNativeRoute: [
    "0x3c70260eee0a2bfc4b375feb810325801f289fbd",
    "0xe9e7cea3dedca5984780bafc599bd69add087d56",
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  ],
  outputToLp0Route: [
    "0x3c70260eee0a2bfc4b375feb810325801f289fbd",
    "0xe9e7cea3dedca5984780bafc599bd69add087d56",
    "0x5801d0e1c7d977d78e4890880b8e579eb4943276",
  ],
  outputToLp1Route: [
    "0x3c70260eee0a2bfc4b375feb810325801f289fbd",
    "0xe9e7cea3dedca5984780bafc599bd69add087d56",
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  ],
};
