export type BillingUserSort = 'user' | 'tokens' | 'credits' | 'grossAmount' | 'netAmount' | 'models';
export interface BillingUserPageRow {
  user: string;
  tokens: number;
  credits: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  models: number | null;
  billingState: 'loaded' | 'Unavailable';
}
export interface BillingUserPage {
  rows: BillingUserPageRow[];
  total: number;
  page: number;
  itemsPerPage: number;
  version: string;
  billingSortAvailable: boolean;
}
