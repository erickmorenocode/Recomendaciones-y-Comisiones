import type { CycleResult } from './commissions';
import type { AlertStatus, RiskEvent } from './risk';

export interface TraderSummary {
  id: number;
  name: string;
  totalRecommended: number;
  openPositions: number;
  alertNotes: AlertNote[];
}

export interface AlertNote {
  event: RiskEvent;
  ticker: string | null;
  detail: string;
  proposedGrade: number;
}

export interface RiskAlert {
  id: string;
  positionId: string | null;
  ticker: string | null;
  event: RiskEvent;
  eventDate: string;
  detail: string;
  proposedGrade: number;
  status: AlertStatus;
  blockActive: boolean;
}

export interface CompanyHolder {
  traderName: string;
  buyPrice: number;
  buyDate: string;
}

export interface TraderLimit {
  base: number;
  incentiveRate: number;
  effective: number;
  maxPosition: number;
  realizedReturn: number;
  /** Tier the trader has earned, which can be above the one applied. */
  earnedRate: number;
}

export interface CarriedCycle {
  cycleStart: string;
  commissions: CycleResult;
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
  carried: CarriedCycle[];
  limit: TraderLimit;
  alerts: RiskAlert[];
  blocked: boolean;
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
