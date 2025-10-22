import { describe, expect, it, beforeEach, vi } from 'vitest';

const mockUsers: Record<string, { user_metadata: Record<string, unknown> }> = {};

vi.mock('@/lib/supabase-admin', () => {
  return {
    createSupabaseAdminClient: () => ({
      auth: {
        admin: {
          getUserById: async (userId: string) => {
            const user = mockUsers[userId] ?? { user_metadata: {} };
            return { data: { user }, error: null };
          },
          updateUserById: async (userId: string, { user_metadata }: { user_metadata: Record<string, unknown> }) => {
            mockUsers[userId] = { user_metadata };
            return { data: { user: { user_metadata } }, error: null };
          }
        }
      }
    })
  };
});

import { addCredits, consumeCredits, getCreditBalance } from '@/services/credits';

const USER_ID = 'user-123';

describe('credits service', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockUsers)) {
      delete mockUsers[key];
    }
  });

  it('returns zero when no metadata is stored', async () => {
    const balance = await getCreditBalance(USER_ID);
    expect(balance).toBe(0);
  });

  it('adds credits and persists them', async () => {
    const nextBalance = await addCredits(USER_ID, 5);
    expect(nextBalance).toBe(5);

    const retrieved = await getCreditBalance(USER_ID);
    expect(retrieved).toBe(5);
  });

  it('migrates legacy referral credits into the unified balance', async () => {
    mockUsers[USER_ID] = {
      user_metadata: {
        referral_credits: 8
      }
    };

    const balance = await getCreditBalance(USER_ID);
    expect(balance).toBe(8);

    const updated = await getCreditBalance(USER_ID);
    expect(updated).toBe(8);
    expect(mockUsers[USER_ID].user_metadata).toMatchObject({ credit_balance: 8, referral_credits: 0 });
  });

  it('consumes credits when balance is sufficient', async () => {
    await addCredits(USER_ID, 3);
    const consumed = await consumeCredits(USER_ID, 2);
    expect(consumed).toBe(true);
    expect(await getCreditBalance(USER_ID)).toBe(1);
  });

  it('fails to consume credits when balance is insufficient', async () => {
    await addCredits(USER_ID, 1);
    const consumed = await consumeCredits(USER_ID, 5);
    expect(consumed).toBe(false);
    expect(await getCreditBalance(USER_ID)).toBe(1);
  });

  it('ignores invalid credit amounts', async () => {
    await expect(addCredits(USER_ID, 0)).rejects.toThrow('Credit amount must be a positive number.');
    expect(await consumeCredits(USER_ID, 0)).toBe(false);
  });
});
