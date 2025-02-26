import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { getMint, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { JsonTrade, JsonTrades } from "./TradingScript/types";
import readline from "readline";
import * as fs from "fs";
import bs58 from 'bs58';
import dotenv from "dotenv";
import { splSwap } from "./TradingScript";
import { sltpManager } from "./TradingScript/sltpManager";
import logger from "./logs/logger";
dotenv.config();

const BOT_SESSION = process.env.BOT_SESSION;
const API_ID = Number(process.env.API_ID);
const API_HASH = String(process.env.API_HASH);
const CHANNELID = String(process.env.CHANNELID);

const RPC_URL = process.env.RPC_URL;
const PUBLICKEY = process.env.PUBLICKEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY || "Invalid";

const SLIPPAGE = Number(process.env.SLIPPAGE);
const AMOUNT = Number(process.env.AMOUNT);
const PRIORITY_FEE = Number(process.env.PRIORITY_FEE);
const JITO_TIP = Number(process.env.JITO_TIP);

if(!RPC_URL) { throw new Error("RPC_URL is not defined in the environment variables."); }
if(!BOT_SESSION){ throw new Error('BOT_SESSION is not defined. Please set it in your environment variables.'); }
if(!API_ID){ throw new Error('API_ID is not defined. Please set it in your environment variables.'); }
if(!API_HASH){ throw new Error('API_HASH is not defined. Please set it in your environment variables.'); }
if(!PUBLICKEY){ throw new Error('PUBLICKEY is not defined. Please set it in your environment variables.'); }
if(!PRIVATE_KEY){ throw new Error('PRIVATE_KEY is not defined. Please set it in your environment variables.'); }

const connection = new Connection(RPC_URL, "confirmed");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
	logger.info("Starting to monitor Telegram Channel...")
	const client = new TelegramClient(new StringSession(BOT_SESSION), API_ID, API_HASH,{ connectionRetries: 5 });
	await client.start({
		phoneNumber: async () => new Promise(resolve => rl.question("Please enter your number: ", resolve)),
		password:    async () => new Promise(resolve => rl.question("Please enter your password: ", resolve)),
		phoneCode:   async () => new Promise(resolve => rl.question("Please enter the code you received: ", resolve)),
		onError: (err) => console.log(err),
	});
	logger.info("You are now connected to Telegram!")
	// console.log("📗Session: ",client.session.save());
  rl.close(); 
	try {
		client.addEventHandler(async event => {
			const message = event.message;
			if (message && message.peerId && message.peerId.channelId && message.peerId.channelId.toString() == CHANNELID) {
				// console.log(message.message)
				const base58Regex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
				const tokens = message.message.match(base58Regex) || [];
				logger.info(`🌟matches: ${tokens}`);
				if (tokens.length) {

					const decimals = (await getMint(connection, new PublicKey(tokens[0]))).decimals;
					// console.log(tokens[0], AMOUNT, SLIPPAGE, PRIORITY_FEE, JITO_TIP)
					const {bundleResult, inAmount, outAmount, swapFeeSOL} = await splSwap(connection, tokens[0], AMOUNT, SLIPPAGE, PRIORITY_FEE, JITO_TIP, PRIVATE_KEY, true) || { bundleResult: "", inAmount: 0, outAmount: 0, swapFeeSOL: 0 };
					if(bundleResult && bundleResult != "") {
						fs.readFile("ct_active_trades.json", 'utf8', (err, data) => {
							if (err) {
									logger.error(`Error reading the file: ${err.message}`)
									return;
							}
							const existingData: JsonTrades = JSON.parse(data);
							const newTrade: JsonTrade = {
								splToken: tokens[0],
								decimals: decimals,
								boughtAmount: outAmount,
								buyAt: new Date().toLocaleTimeString(),
								buyTxn: bundleResult,
								sellAt: "",
								sellTxn: "",
								initialInvest: inAmount,
								priorityFee: PRIORITY_FEE,
								jitoTip: JITO_TIP,
								buySwapFee: swapFeeSOL,
								sellSwapFee: 0,
								pnl: 0,
								isConfirmed: true
							};
							existingData.trades.push(newTrade);
							fs.writeFile("ct_active_trades.json", JSON.stringify(existingData, null, 2), 'utf8', (err) => {
								if (err) {
										logger.error(`Error writing to the file: ${err.message}`)
										return;
								}
								logger.info('New trade added successfully!');
							});
						});
					}
				}
			}
		});

		setInterval(sltpManager, 900);
	} catch (err:any) {
		logger.error(`Error accessing channel ${err.message}`);
	}
}

main();