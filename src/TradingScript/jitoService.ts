import axios from "axios";
import { SystemProgram, PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import {
  client,
  wallet_2_pay_jito_fees_keypair,
  connection,
  BLOCK_ENGINE_URL,
  jitoRpcUrl,
  // httpsAgent
} from "./config";

import { isError } from "jito-ts/dist/sdk/block-engine/utils";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types.js";
import { VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import logger from "../logs/logger";

const TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
].map((pubkey) => new PublicKey(pubkey));

export const addTipIx = (keypair: Keypair, tipAccount: PublicKey, tipLamports: number) => {
  const tipIx = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: tipAccount,
    lamports: tipLamports,
  });

  return tipIx;
};

export const getJitoTipIx = async (payer: string | Uint8Array) => {
  const { data } = await axios.post(
    jitoRpcUrl,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "getTipAccounts",
      params: [],
    },
    {
      headers: {
        "Content-Type": "application/json",
      }
    }
  );

  const tipIx = SystemProgram.transfer({
    fromPubkey: new PublicKey(payer),
    toPubkey: new PublicKey(data.result[0]),
    lamports: 1000_000,
  });
  return tipIx;
};

export const getBundleStatus = async (bundleId: string) => {
  const { data } = await axios.post(
    jitoRpcUrl,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "getBundleStatuses",
      params: [[bundleId]],
    },
    {
      headers: {
        "Content-Type": "application/json",
      }
    }
  );
  return data;
};

export const getJitoBundle = async (signedTransaction: string) => {
  try {
    const { data: sendBundleResponse } = await axios.post(
      jitoRpcUrl,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [signedTransaction],
      },
      {
        headers: {
          "Content-Type": "application/json",
        }
      }
    );

    let currentStatus = await getBundleStatus(sendBundleResponse.result);
    const baseSlot = currentStatus.result.context.slot;
    let currentSlot = baseSlot;

    while (currentSlot < baseSlot + 150) {
      if (currentStatus.result.value.length > 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      currentStatus = await getBundleStatus(sendBundleResponse.result);
      currentSlot = currentStatus.result.context.slot;
    }

    if (
      currentStatus.result.value.length === 0 ||
      currentStatus.result.value[0].err.Ok !== null
    ) {
      return { bundleId: null, txId: null };
    }

    return {
      bundleId: sendBundleResponse.result,
      txId: currentStatus.result.value[0].transactions[0],
    };
  } catch (error: any) {
    throw Error(error);
  }
};

const onSignatureResult = async (connection: Connection, signature: string) => {
  console.log("OnSignature", signature);
  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      console.log("transaction failed", signature);
      reject(false);
    }, 30000);
    connection.onSignature(
      signature,
      (updatedTxInfo, context) => {
        console.log("update account info", updatedTxInfo);
        clearTimeout(timeout);
        resolve(true);
      },
      "confirmed"
    );
  });
};

const onBundleResultFromConfirmTransaction = async (connection: Connection, signatures: string[]) => {
  for (const signature of signatures) {
    try {
      const txResult = await onSignatureResult(connection, signature);
      console.log("txResult", txResult, signature);
      if (txResult == false) return false;
    } catch (err) {
      console.log("transaction confirmation error", err);
      return false;
    }
  }
  return true;
};

export const getJitoSignatures = async (connection: Connection, signedTransactions: any[]) => {
  const bundle = new Bundle(signedTransactions, signedTransactions.length + 1);

  const { blockhash } = await connection.getLatestBlockhash("finalized");
  // const _tipAccount = (await client.getTipAccounts())[0];
  const tipAccount =
    TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];
  console.log("tip account:", tipAccount);

  let maybeBundle = bundle.addTipTx(
    wallet_2_pay_jito_fees_keypair,
    1000000,
    tipAccount,
    blockhash
  );

  if (isError(maybeBundle)) {
    throw maybeBundle;
  }

  const signatures = signedTransactions.map((signedTx) => {
    return bs58.encode(signedTx.signatures[0]);
  });

  return signatures;
};

export const sendBundle = async (connection: Connection, signedTransaction: VersionedTransaction, tip: number) => {
  try {
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    const tipAccount =
      TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];

    const instruction1 = SystemProgram.transfer({
      fromPubkey: wallet_2_pay_jito_fees_keypair.publicKey,
      toPubkey: tipAccount,
      lamports: tip*LAMPORTS_PER_SOL,
    });

    const messageV0 = new TransactionMessage({
      payerKey: wallet_2_pay_jito_fees_keypair.publicKey,
      instructions: [instruction1],
      recentBlockhash: blockhash,
    }).compileToV0Message();

    const vTxn = new VersionedTransaction(messageV0);
    const signatures = [signedTransaction, vTxn].map((signedTx) => {
      return bs58.encode(signedTx.signatures[0]);
    });
    // console.log("bundle signatures", signatures);
    vTxn.sign([wallet_2_pay_jito_fees_keypair]);

    const encodedTx = [signedTransaction, vTxn].map((tx) =>
      bs58.encode(tx.serialize())
    );

    // const encodedTx = txn.map((tx) => bs58.default.encode(txn1.serialize()));
    const jitoURL = `${BLOCK_ENGINE_URL}/api/v1/bundles`; // ?uuid=${JITO_UUID}
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendBundle",
      // params: [[bs58.default.encode(vTxn.serialize())]],
      params: [encodedTx],
    };
    // console.log('payload', payload)
    try {
      const response = await axios.post(jitoURL, payload, {
        headers: { "Content-Type": "application/json" },
        // httpsAgent: httpsAgent
      });
      // return response.data.result;
      if(response.status != 200){
        logger.error("Axios Error in Jito Bundle Posting");
        return null;
      }
      return signatures[0];
    } catch (error) {
      logger.error("Cannot Send")
      return null;
    }
  } catch (error: any) {
    const err = error;
    logger.error("Error sending bundle:")

    if (err?.message?.includes("Bundle Dropped, no connected leader up soon")) {
      logger.error("Error sending bundle: Bundle Dropped, no connected leader up soon.")
    } else {
      logger.critical("An unexpected error occurred:");
    }
  }
};

export const sendBundleAPI = async (serializedTransaction: any) => {
  const encodedTx = bs58.encode(serializedTransaction);
  const jitoURL = `${BLOCK_ENGINE_URL}/api/v1/bundles`; // ?uuid=${JITO_UUID}
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "sendBundle",
    params: [[encodedTx]],
  };

  try {
    const response = await axios.post(jitoURL, payload, {
      headers: { "Content-Type": "application/json" }
    });
    return response.data.result;
  } catch (err) {
    logger.error(`cannot send!: ${err}`);
    return null;
  }
};
