import { Wallet } from "@project-serum/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import axios from "axios";

export const getResponse = async (tokenA: string, tokenB: string, amount: number, slippageBps: number) => {
  const response = await axios.get(`https://api.jup.ag/swap/v1/quote?inputMint=${tokenA}&outputMint=${tokenB}&amount=${amount}&slippageBps=${slippageBps}`);
  const quoteResponse = response.data;
  return quoteResponse;
  // Get the serialized transactions to perform the swap
};


export const getSwapInfo = async (tokenA: string, tokenB: string, amount: number, slippageBps: number) => {
  try {const response = await axios.get(`https://api.jup.ag/swap/v1/quote?inputMint=${tokenA}&outputMint=${tokenB}&amount=${amount}&slippageBps=${slippageBps}`);
  const swapinfo = response.data;
  return swapinfo;} catch(err) {
    return false;
  }
  // Get the serialized transactions to perform the swap
};

export const getSwapTransaction = async (quoteResponse: any, anchorWallet: Wallet, fee: number) => {
  const swapResponse = await axios.post(`https://api.jup.ag/swap/v1/swap`, {
    // quoteResponse from /quote api
    quoteResponse,
    // user public key to be used for the swap
    userPublicKey: anchorWallet.publicKey.toString(),
    // auto wrap and unwrap SOL. default is true
    wrapAndUnwrapSol: true,
    // dynamicComputeUnitLimit: true, // allow dynamic compute limit instead of max 1,400,000
    prioritizationFeeLamports: fee*LAMPORTS_PER_SOL, // or custom lamports: 1000
    // dynamicSlippage: { maxBps: 300 },
    // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
    // feeAccount: "fee_account_public_key"
  });
  return swapResponse.data.swapTransaction;
  // console.log("quoteResponse", quoteResponse);
  // Get the serialized transactions to perform the swap
};
