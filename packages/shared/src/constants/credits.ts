import type { CreditCosts } from '../types/credits';

export const DEFAULT_CREDIT_COSTS: CreditCosts = {
  quickGen1k: 5,
  quickGen2k: 10,
  shopifyGen1k: 5,
  shopifyGen2k: 10,
  photoshoot1k: 3,
  photoshoot2k: 7,
  modelGeneration: 2,
  backgroundGeneration: 2,
  videoGeneration: 15,
};

export const LOW_CREDIT_THRESHOLD_DEFAULT = 50;
