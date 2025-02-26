import { Keypair, Connection, LAMPORTS_PER_SOL, VersionedTransaction, PublicKey } from "@solana/web3.js";
import { getSwapInfo, getSwapTransaction } from "./jupiterService";
import { NATIVE_MINT, getMint } from "@solana/spl-token";
import { sendBundle } from "./jitoService";
import { Wallet } from "@project-serum/anchor";
import bs58 from "bs58";
import dotenv from 'dotenv';
import logger from "../logs/logger";

dotenv.config();

export const splSwap = async (connection:Connection, spl:string, inAmount:number, slippage:number, fee:number, tip:number, priKey:string, isBuy:Boolean) => {
  const decimals = (await getMint(connection, new PublicKey(spl))).decimals;
  let success = false;
  while (success == false) {
    const buyer = Keypair.fromSecretKey(bs58.decode(priKey));
    const buyerAnchorWallet = new Wallet(buyer);
    const swapInfo = isBuy
      ? await getSwapInfo(NATIVE_MINT.toBase58(), spl, inAmount * LAMPORTS_PER_SOL, slippage)
      : await getSwapInfo(spl, NATIVE_MINT.toBase58(), inAmount * 10**decimals, slippage);
    if(!swapInfo){
      logger.warn(`No Swap Info`)
      return null;
    }
    const outAmount = isBuy ? swapInfo.outAmount / 10 ** decimals : swapInfo.outAmount / LAMPORTS_PER_SOL;
    const feeMint = swapInfo.routePlan[0].swapInfo.feeMint;
    let swapFeeSOL = 0;
    if(feeMint == "So11111111111111111111111111111111111111112"){
      swapFeeSOL = swapInfo.routePlan[0].swapInfo.feeAmount / 10**9;
    } else {
      const rawPriceList = await fetch(`https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112,${feeMint}&showExtraInfo=true`);
      const priceList = await rawPriceList.json();
      const feeMintDecimals = (await getMint(connection, new PublicKey(feeMint))).decimals;
      const swapFee = swapInfo.routePlan[0].swapInfo.feeAmount
      const solPrice = Number(priceList.data["So11111111111111111111111111111111111111112"].price);
      const tokenPrice = Number(priceList.data[feeMint].price);
      swapFeeSOL = tokenPrice / solPrice * swapFee / 10**feeMintDecimals;
    }
    const Txn = await getSwapTransaction( swapInfo, buyerAnchorWallet, fee );
    if (Txn == null) { continue; }
    const swapTxnBuf = Buffer.from(Txn, "base64");
    const latestBlockHash = await connection.getLatestBlockhash();
    const vTxn = VersionedTransaction.deserialize(swapTxnBuf);
    vTxn.message.recentBlockhash = latestBlockHash.blockhash;
    vTxn.sign([buyerAnchorWallet.payer]);

    let bundleResult = "";
    try {
      bundleResult = await sendBundle(connection, vTxn, tip) || "";
      success = true;
      return {bundleResult, inAmount, outAmount, swapFeeSOL};
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return null;
    }
  }
  process.exit(0);
};