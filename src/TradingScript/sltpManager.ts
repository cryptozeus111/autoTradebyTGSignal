import * as fs from "fs";
import { JsonTrades } from "./types";
import bs58 from 'bs58';

import dotenv from "dotenv";
import { Keypair, PublicKey } from "@solana/web3.js";
import { connection } from "./config";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { splSwap } from ".";
import logger from "../logs/logger";
dotenv.config();

const BOT_SESSION = process.env.BOT_SESSION;
const API_ID = Number(process.env.API_ID);
const TAKE_PROFIT = Number(process.env.TAKE_PROFIT);
const STOP_LOSS = Number(process.env.STOP_LOSS);
const SLIPPAGE = Number(process.env.SLIPPAGE);
const API_HASH = String(process.env.API_HASH);
const PRIORITY_FEE = Number(process.env.PRIORITY_FEE);
const JITO_TIP = Number(process.env.JITO_TIP);
const RPC_URL = process.env.RPC_URL;
const PUBLICKEY = process.env.PUBLICKEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY || "Invalid";
if (!RPC_URL) { throw new Error("RPC_URL is not defined in the environment variables."); }
if(!BOT_SESSION){ throw new Error('BOT_SESSION is not defined. Please set it in your environment variables.'); }
if(!API_ID){ throw new Error('API_ID is not defined. Please set it in your environment variables.'); }
if(!API_HASH){ throw new Error('API_HASH is not defined. Please set it in your environment variables.'); }
if(!PUBLICKEY){ throw new Error('PUBLICKEY is not defined. Please set it in your environment variables.'); }
if(!PRIVATE_KEY){ throw new Error('PRIVATE_KEY is not defined. Please set it in your environment variables.'); }

export async function sltpManager() {
	fs.readFile("ct_active_trades.json", "utf8", async (err, data) => {
		if(err){
			if (err.code === "ENOENT") {
				console.error("File not found: ct_active_trades.json. Creating a new file...");
				const defaultData = JSON.stringify({ trades: [] }, null, 2);
				fs.writeFile("ct_active_trades.json", defaultData, "utf8", (writeErr) => {
					if (writeErr) {
						console.error("Error creating the file:", writeErr);
					} else {
						console.log("File created successfully with default content.");
					}
				});
			} else {
				console.error("Error reading the file:", err);
			}
			return;
		}
		const existingData: JsonTrades = JSON.parse(data);
		const trades = existingData.trades;
		if (trades.length) {
			try{
				let tokenList = "So11111111111111111111111111111111111111112";
				trades.forEach(item => tokenList += `,${item.splToken}`);
				const rawPriceList = await fetch(`https://api.jup.ag/price/v2?ids=${tokenList}&showExtraInfo=true`);
				const priceList = await rawPriceList.json();
				trades.forEach(async item => {
					const solPrice = Number(priceList.data["So11111111111111111111111111111111111111112"].price);
					const tokenPrice = Number(priceList.data[item.splToken].price);
					logger.info(`Token Price: ${tokenPrice}, solPrice: ${solPrice}`)
					const tp = tokenPrice/solPrice*item.initialInvest/10**item.decimals;
					if (tp > TAKE_PROFIT || tp < STOP_LOSS) { 
						// console.log(`📈take profit\n${tp}: ${item.initialInvest}: ${solPrice}: ${tokenPrice}: ${item.decimals}`);
						// Sell Function goes here
						// sellToken(item.tokenAddress);
						const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
						const Ata = await getOrCreateAssociatedTokenAccount(
							connection,
							keypair, 
							new PublicKey(item.splToken),
							keypair.publicKey
						);
						const tokenAmount = await connection.getTokenAccountBalance(Ata.address);
						const sellAmount = tokenAmount.value.uiAmount || 0;
						// console.log("5");
						const {bundleResult, inAmount, outAmount, swapFeeSOL} = await splSwap(
							connection, item.splToken, sellAmount, SLIPPAGE, PRIORITY_FEE, JITO_TIP, PRIVATE_KEY, false
						) || {bundleResult:"", inAmount:0, outAmount:0, swapFeeSOL:0}
						if (bundleResult) {
							fs.readFile("ct_active_trades.json", 'utf8', (err, data) => {
								if (err) {
										console.error('Error reading the file:', err);
										return;
								}
								const existingData: JsonTrades = JSON.parse(data);
								// const trade = existingData.trades.find(t => t.tokenAddress === TOKEN_ADDRESS);
								const tradeIndex = existingData.trades.findIndex(t => t.splToken === item.splToken);
								if (tradeIndex !== -1){
										const [foundTrade] = existingData.trades.splice(tradeIndex, 1);
										foundTrade.sellAt = new Date().toLocaleTimeString();
										foundTrade.sellTxn = bundleResult;
										foundTrade.sellSwapFee = swapFeeSOL;
										foundTrade.pnl = (outAmount - foundTrade.initialInvest)/foundTrade.initialInvest * 100;
										fs.writeFile("ct_active_trades.json", JSON.stringify(existingData, null, 2), 'utf8', (err) => {
												if (err) {
														console.error('Error writing to the active trades file:', err);
														return;
												}
												console.log('Trade removed from active trades successfully!');
										});
										fs.readFile("ct_completed_trades.json", 'utf8', (err, data) => {
												if (err) {
														console.error('Error reading the completed trades file:', err);
														return;
												}
												const completedTrades = JSON.parse(data); 
												completedTrades.trades.push(foundTrade);
												fs.writeFile("ct_completed_trades.json", JSON.stringify(completedTrades, null, 2), 'utf8', err => {
														if (err) {
																console.error('Error writing to the completed trades file:', err);
																return;
														}
														console.log('Trade added to completed trades successfully!');
												});
										});
								} else {
										// console.log('No matching trade found in active trades.');
								}
							});
						}
					} else {
						logger.info(`🎯 Waiting TP/SL...`);
					}
				});
			}catch(err){
				return;
			}
		} else {
			return;
		}
	});
}