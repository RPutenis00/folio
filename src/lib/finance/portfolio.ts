import type { AssetCategory } from "../constants";

export type AssetValuation = {
  assetId: string;
  category: AssetCategory;
  marketValueEur: number;
  costBasisEur: number;
};

export type PortfolioRollup = {
  totalValueEur: number;
  totalCostBasisEur: number;
  unrealizedPnlEur: number;
  byCategory: Record<AssetCategory, number>;
};

const EMPTY_BY_CATEGORY: Record<AssetCategory, number> = {
  stock: 0,
  etf: 0,
  fund: 0,
  crypto: 0,
  real_estate: 0,
  cash: 0,
  bond: 0,
  other: 0,
};

export function rollupPortfolio(valuations: AssetValuation[]): PortfolioRollup {
  const byCategory: Record<AssetCategory, number> = { ...EMPTY_BY_CATEGORY };
  let totalValueEur = 0;
  let totalCostBasisEur = 0;

  for (const v of valuations) {
    byCategory[v.category] = (byCategory[v.category] ?? 0) + v.marketValueEur;
    totalValueEur += v.marketValueEur;
    totalCostBasisEur += v.costBasisEur;
  }

  return {
    totalValueEur,
    totalCostBasisEur,
    unrealizedPnlEur: totalValueEur - totalCostBasisEur,
    byCategory,
  };
}
