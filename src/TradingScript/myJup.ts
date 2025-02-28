import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const JUPBASE = "https://api.jup.ag/swap/v1/";

async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
) {
  const quoteResponse = await (
    await fetch(
      `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`
    )
  ).json();
  console.log(JSON.stringify(quoteResponse, null, 2));
}

const inputMint = "So11111111111111111111111111111111111111112";
const outputMint = "DQ1rawNKqRK76iN8KmXVssWeTKXAm2Kq7AVBiB1Epump";
const amount = 0.015*LAMPORTS_PER_SOL
const slippageBps = 100

getQuote(inputMint, outputMint, amount, slippageBps);