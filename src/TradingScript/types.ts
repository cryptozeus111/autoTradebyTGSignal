import { PublicKey } from "@solana/web3.js";

export interface JsonTrades {
  trades: JsonTrade[];
}
export interface JsonTrade {
  splToken: string;
  decimals: number;
  boughtAmount: number;
  buyAt: string;
  buyTxn: string;
  sellAt: string;
  sellTxn: string;
  initialInvest: number;
  priorityFee: number;
  jitoTip: number;
  buySwapFee: number;
  sellSwapFee: number;
  pnl: number;
  isConfirmed: boolean;
}

export type SwapParam = {
  private_key: string;
  mint: PublicKey;
  amount: number;
  tip: number;
  slippage: number;
  is_buy: boolean;
};