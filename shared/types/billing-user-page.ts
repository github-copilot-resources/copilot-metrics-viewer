export interface BillingUserRow {
  user: string;
  tokens: number;
  credits: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  models: number | null;
}

export type BillingUserPage =
  | { available: false; reason: string }
  | {
    available: true;
    rows: BillingUserRow[];
    total: number;
    topTokenUsers: { user: string; tokens: number }[];
    window: { startDate: string; endDate: string };
    lastImportAt: string | null;
  };
