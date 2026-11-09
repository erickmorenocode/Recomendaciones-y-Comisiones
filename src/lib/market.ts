// Server only: Yahoo Finance access through yahoo-finance2.
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  currency: string | null;
}

export interface MarketSearchResult {
  symbol: string;
  name: string;
  exchange: string | null;
}

export async function getQuote(symbol: string): Promise<MarketQuote | null> {
  try {
    const quote = await yahooFinance.quote(symbol);
    if (!quote || quote.regularMarketPrice == null) return null;
    return {
      symbol: quote.symbol,
      name: quote.longName ?? quote.shortName ?? quote.symbol,
      price: quote.regularMarketPrice,
      currency: quote.currency ?? null,
    };
  } catch (error) {
    console.error(`Yahoo quote failed for ${symbol}:`, error);
    return null;
  }
}

/** Live price per symbol. Symbols Yahoo cannot price are left out. */
export async function getLivePrices(symbols: string[]): Promise<Record<string, number>> {
  const quotes = await Promise.all([...new Set(symbols)].map(getQuote));
  return Object.fromEntries(quotes.flatMap((quote) => (quote ? [[quote.symbol, quote.price]] : [])));
}

// A past daily close does not change, so it is safe to keep for the process lifetime.
const closeCache = new Map<string, number>();

async function getCloseOnOrBefore(symbol: string, date: string): Promise<number | null> {
  const cacheKey = `${symbol}|${date}`;
  const cached = closeCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const end = new Date(`${date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 12);

  try {
    const chart = await yahooFinance.chart(symbol, { period1: start, period2: end, interval: '1d' });
    const closes = chart.quotes.filter(
      (bar) => bar.close != null && bar.date.toISOString().slice(0, 10) <= date,
    );
    const close = closes.at(-1)?.close;
    if (close == null) return null;
    closeCache.set(cacheKey, close);
    return close;
  } catch (error) {
    console.error(`Yahoo chart failed for ${symbol} on ${date}:`, error);
    return null;
  }
}

/** Closing price per symbol on a cut date. Symbols without data are left out. */
export async function getClosePrices(symbols: string[], date: string): Promise<Record<string, number>> {
  const entries = await Promise.all(
    [...new Set(symbols)].map(async (symbol) => [symbol, await getCloseOnOrBefore(symbol, date)] as const),
  );
  return Object.fromEntries(entries.filter((entry): entry is [string, number] => entry[1] !== null));
}

interface RawSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  quoteType?: string;
  isYahooFinance?: boolean;
}

export async function searchCompanies(query: string): Promise<MarketSearchResult[]> {
  const result = await yahooFinance.search(query, { quotesCount: 8, newsCount: 0 });
  return (result.quotes as unknown as RawSearchQuote[])
    .filter((q) => q.isYahooFinance && q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
    .map((q) => ({
      symbol: q.symbol!,
      name: q.longname ?? q.shortname ?? q.symbol!,
      exchange: q.exchDisp ?? null,
    }));
}
