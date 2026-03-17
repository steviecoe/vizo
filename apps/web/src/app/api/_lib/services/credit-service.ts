import * as admin from 'firebase-admin';
import type { CreditLedgerEntry, LedgerEntryType } from '@vizo/shared';
import { getDb } from '../admin';

export async function reserveCredits(
  tenantId: string,
  amount: number,
  type: LedgerEntryType,
  description: string,
  referenceId: string,
  createdBy: string,
): Promise<string> {
  const db = getDb();
  const tenantRef = db.doc(`tenants/${tenantId}`);
  const ledgerRef = db.collection(`tenants/${tenantId}/creditLedger`).doc();

  await db.runTransaction(async (tx) => {
    const tenantDoc = await tx.get(tenantRef);
    if (!tenantDoc.exists) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const currentBalance = tenantDoc.data()!.creditBalance as number;
    if (currentBalance < amount) {
      throw new Error(
        `Insufficient credits: balance=${currentBalance}, required=${amount}`,
      );
    }

    const newBalance = currentBalance - amount;

    const entry: Omit<CreditLedgerEntry, 'id'> = {
      type,
      amount: -amount,
      balanceAfter: newBalance,
      description,
      referenceId,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    tx.update(tenantRef, {
      creditBalance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(ledgerRef, entry);
  });

  return ledgerRef.id;
}

export async function refundCreditsForFailure(
  tenantId: string,
  amount: number,
  originalJobId: string,
  createdBy: string,
): Promise<string> {
  const db = getDb();
  const tenantRef = db.doc(`tenants/${tenantId}`);
  const ledgerRef = db.collection(`tenants/${tenantId}/creditLedger`).doc();

  await db.runTransaction(async (tx) => {
    const tenantDoc = await tx.get(tenantRef);
    if (!tenantDoc.exists) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const currentBalance = tenantDoc.data()!.creditBalance as number;
    const newBalance = currentBalance + amount;

    const entry: Omit<CreditLedgerEntry, 'id'> = {
      type: 'refund_generation_failure',
      amount: amount,
      balanceAfter: newBalance,
      description: `Auto-refund for failed generation job ${originalJobId}`,
      referenceId: originalJobId,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    };

    tx.update(tenantRef, {
      creditBalance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(ledgerRef, entry);
  });

  return ledgerRef.id;
}

export async function adminTopup(
  tenantId: string,
  amount: number,
  description: string,
  adminUid: string,
): Promise<string> {
  const db = getDb();
  const tenantRef = db.doc(`tenants/${tenantId}`);
  const ledgerRef = db.collection(`tenants/${tenantId}/creditLedger`).doc();

  await db.runTransaction(async (tx) => {
    const tenantDoc = await tx.get(tenantRef);
    if (!tenantDoc.exists) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const currentBalance = tenantDoc.data()!.creditBalance as number;
    const newBalance = currentBalance + amount;

    const entry: Omit<CreditLedgerEntry, 'id'> = {
      type: 'topup_admin',
      amount,
      balanceAfter: newBalance,
      description,
      referenceId: null,
      createdAt: new Date().toISOString(),
      createdBy: adminUid,
    };

    tx.update(tenantRef, {
      creditBalance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(ledgerRef, entry);
  });

  return ledgerRef.id;
}
