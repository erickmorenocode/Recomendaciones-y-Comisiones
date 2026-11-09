import type { CycleResult } from './commissions';

export interface TraderSummary {
  id: number;
  name: string;
  totalRecommended: number;
  openPositions: number;
}

export interface TradersResponse {
  traders: TraderSummary[];
  cycleStart: string | null;
}

export interface PositionView {
  id: string;
  ticker: string;
  companyName: string;
  buyDate: string;
  buyPrice: number;
  shares: number;
  sellDate: string | null;
  sellPrice: number | null;
  total: number;
  marketPrice: number | null;
  result: number | null;
  inCycle: boolean;
  hasReport: boolean;
}

export interface TraderDetail {
  id: number;
  name: string;
  cycleStart: string | null;
  cycleEnd: string | null;
  totalRecommended: number;
  positions: PositionView[];
  commissions: CycleResult | null;
}

export interface Movement {
  id: number;
  created_at: string;
  action: string;
  ticker: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AnalystRatings {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface CompanyOption {
  symbol: string;
  name: string;
  exchange: string | null;
}
