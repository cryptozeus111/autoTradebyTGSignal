import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import dotenv from "dotenv";
// import { HttpsProxyAgent } from "https-proxy-agent";

import {
  SearcherClient,
  searcherClient,
} from "jito-ts/dist/sdk/block-engine/searcher";
// dotenv.config({
//   path: "../.env",
// });
dotenv.config();
// ---------- General Setting ------------- //

const rpc = process.env.RPC_URL; // ENTER YOUR RPC
const devnetRPC = process.env.DEVNET_RPC || "";
if (!rpc) {
  throw new Error("RPC_URL is not defined in .env file");
}

export const connection = new Connection(rpc, "confirmed");
// export const devnetConnection = new Connection(devnetRPC, "confirmed");
// ----------- Jito Bundle Setting ------------- //
/* BlockEngine Url
 * There are 4 for mainnet and 2 for testnet.
 * https://amsterdam.mainnet.block-engine.jito.wtf
 * https://frankfurt.mainnet.block-engine.jito.wtf
 * https://ny.mainnet.block-engine.jito.wtf
 * https://tokyo.mainnet.block-engine.jito.wtf
 */
// export const blockEngineUrl = 'frankfurt.mainnet.block-engine.jito.wtf';
export const blockEngineUrl = "ny.mainnet.block-engine.jito.wtf";
export const BLOCK_ENGINE_URL = "https://frankfurt.mainnet.block-engine.jito.wtf";
// export const BLOCK_ENGINE_URL = "https://ny.mainnet.block-engine.jito.wtf";
/* Private key for Bundle. Not required in jito-ts v4. */
if (!process.env.JITO_AUTH_PRIVATE_KEY) {
  throw new Error("JITO_AUTH_PRIVATE_KEY is not defined in .env file");
}
const jito_auth_private_key = process.env.JITO_AUTH_PRIVATE_KEY;

/* Wallet for jito tip */
if (!process.env.JITO_FEE_PAYER) {
  throw new Error("JITO_FEE_PAYER is not defined in .env file");
}
const wallet_2_pay_jito_fees = process.env.JITO_FEE_PAYER;

// ----------- Distribution ------------- //
export const RayLiqPoolv4 = new PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
);

// ----------- Liquidity Manager ----------- //

/* The wallet private key for which the pool is being created. Must be the owner of token */
const LP_wallet_private_key = "";

/* The wallet private key for swap */
const swap_wallet_private_key = "";

// swap info:
export const swap_sol_amount = 0.1; //Amount of SOl u want to invest
export const sell_swap_tokens_percentage = 1; // % of tokens u want to sell=> 1 means 100%
export const sell_swap_take_profit_ratio = 1; // take profit e.g. 2x 3x

// swap sell and remove lp fees in lamports.
export const sell_remove_fees = 5000000;

// ignore these
export const jito_auth_keypair = Keypair.fromSecretKey(
  new Uint8Array(base58.decode(jito_auth_private_key))
);
export const wallet_2_pay_jito_fees_keypair = Keypair.fromSecretKey(
  new Uint8Array(base58.decode(wallet_2_pay_jito_fees))
);

// export const LP_wallet_keypair = Keypair.fromSecretKey(
//   new Uint8Array(base58.decode(LP_wallet_private_key))
// );
// export const swap_wallet_keypair = Keypair.fromSecretKey(
//   new Uint8Array(base58.decode(swap_wallet_private_key))
// );

export const bundleTransactionLimit = parseInt(
  process.env.BUNDLE_TRANSACTION_LIMIT || "5"
);

export const lookupTableCache = {};
export const addLookupTableInfo = undefined; // only mainnet. other = undefined

// jito search client
// export const client = searcherClient(blockEngineUrl, jito_auth_keypair, {
//   "grpc.keepalive_timeout_ms": 4000,
// });
export const client = searcherClient(blockEngineUrl);

export const jitoRpcUrl = "https://ny.mainnet.block-engine.jito.wtf";

const PROXY_CONFIG = {
  host: "geo.iproyal.com",
  port: 12321,
  auth: "92oOcRXzYcRbYh6N:KoRAD",
};


// export const httpsAgent = new HttpsProxyAgent(
//   `http://${PROXY_CONFIG.auth.split(":")[0]}:${PROXY_CONFIG.auth.split(":")[1]
//   }@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`
// );