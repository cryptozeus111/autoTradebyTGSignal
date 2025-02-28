import {
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";
import { getSwapInfo, getSwapTransaction } from "./jupiterService";
import {
  NATIVE_MINT,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { sendBundle } from "./jitoService";
import { Wallet } from "@project-serum/anchor";
import bs58 from "bs58";
import dotenv from "dotenv";
import logger from "../logs/logger";

dotenv.config();

if (!process.env.PRIVATE_KEY) {
  throw new Error("Invalid PRIVATE_KEY Error");
}
const PRIVATE_KEY = process.env.PRIVATE_KEY;

export const splSwap = async (
  connection: Connection,
  spl: string,
  inAmount: number,
  slippage: number,
  fee: number,
  tip: number,
  priKey: string,
  isBuy: boolean
) => {
  try {
    const decimals = (await getMint(connection, new PublicKey(spl))).decimals;
    let success = false;

    while (!success) {
      const buyer = Keypair.fromSecretKey(bs58.decode(priKey));
      const buyerAnchorWallet = new Wallet(buyer);

      // Get swap information
      const swapInfo = isBuy
        ? await getSwapInfo(
            NATIVE_MINT.toBase58(),
            spl,
            inAmount * LAMPORTS_PER_SOL,
            slippage
          )
        : await getSwapInfo(
            spl,
            NATIVE_MINT.toBase58(),
            inAmount * 10 ** decimals,
            slippage
          );

      if (!swapInfo) {
        logger.warn("No Swap Info available");
        continue;
      }

      const outAmount = isBuy
        ? swapInfo.outAmount / 10 ** decimals
        : swapInfo.outAmount / LAMPORTS_PER_SOL;

      // Calculate swap fee in SOL
      const feeMint = swapInfo.routePlan[0].swapInfo.feeMint;
      let swapFeeSOL = 0;

      if (feeMint === "So11111111111111111111111111111111111111112") {
        swapFeeSOL = swapInfo.routePlan[0].swapInfo.feeAmount / 10 ** 9;
      } else {
        const rawPriceList = await fetch(
          `https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112,${feeMint}&showExtraInfo=true`
        );
        const priceList = await rawPriceList.json();
        const feeMintDecimals = (
          await getMint(connection, new PublicKey(feeMint))
        ).decimals;
        const swapFee = swapInfo.routePlan[0].swapInfo.feeAmount;
        const solPrice = Number(
          priceList.data["So11111111111111111111111111111111111111112"].price
        );
        const tokenPrice = Number(priceList.data[feeMint].price);
        swapFeeSOL =
          (tokenPrice / solPrice) * (swapFee / 10 ** feeMintDecimals);
      }

      // Get swap transaction
      const Txn = await getSwapTransaction(swapInfo, buyerAnchorWallet, fee);
      if (!Txn) {
        logger.warn("Failed to get swap transaction");
        continue;
      }

      const swapTxnBuf = Buffer.from(Txn, "base64");
      const latestBlockHash = await connection.getLatestBlockhash();
      const vTxn = VersionedTransaction.deserialize(swapTxnBuf);
      vTxn.message.recentBlockhash = latestBlockHash.blockhash;
      vTxn.sign([buyerAnchorWallet.payer]);

      try {
        if (!process.env.PUBLICKEY) {
          throw new Error("Wallet PublicKey is missing in .env file");
        }

        // Send the transaction bundle
        const bundleResult = (await sendBundle(connection, vTxn, tip)) || "";

        // Check token balance after swap
        const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
        const Ata = await getOrCreateAssociatedTokenAccount(
          connection,
          keypair,
          new PublicKey(spl),
          keypair.publicKey
        );
        const tokenAmount = await connection.getTokenAccountBalance(
          Ata.address
        );
        const sellAmount = tokenAmount.value.uiAmount || 0;

        if (sellAmount > 0) {
          success = true;
          return { bundleResult, inAmount, outAmount, swapFeeSOL };
        } else {
          logger.warn("Swap unsuccessful, retrying...");
          success = false;
        }
      } catch (error) {
        logger.error(`Error during transaction processing`);
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Retry after delay
      }
    }
  } catch (error) {
    logger.error("Critical error in splSwap function:");
    return null;
  }

  process.exit(0);
};
