import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { bucketFor, paiseToInr, REVENUE_DEFINITION, revenueBySource } from './admin-revenue';

type Row = Record<string, any>;

// 2026-10-08 11:30 IST → reporting month 2026-10 starts 2026-09-30T18:30:00Z.
const NOW = new Date('2026-10-08T06:00:00.000Z');
const IN_MONTH = new Date('2026-09-30T18:40:00.000Z'); // 1 Oct 00:10 IST
const BEFORE_MONTH = new Date('2026-09-30T18:20:00.000Z'); // 30 Sep 23:50 IST

let seq = 0;
function payment(over: Row): Row {
  return {
    id: `p${++seq}`,
    employerId: 'e1',
    jobId: null,
    hiringOutcomeId: null,
    providerRef: null,
    amountPaise: 0,
    status: 'PAID',
    paidAt: IN_MONTH,
    ...over,
  };
}

function matchValue(value: unknown, cond: any): boolean {
  if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
    if ('gt' in cond) return (value as number) > cond.gt;
    if ('gte' in cond) return (value as Date) >= cond.gte;
    if ('startsWith' in cond) return typeof value === 'string' && value.startsWith(cond.startsWith);
    if ('not' in cond) return cond.not === null ? value != null : value !== cond.not;
  }
  return value === cond;
}
const matches = (row: Row, where: Row = {}) => Object.entries(where).every(([k, c]) => matchValue(row[k], c));

function fakePrisma(payments: Row[]) {
  const sum = (rows: Row[]) => (rows.length ? rows.reduce((n, r) => n + r.amountPaise, 0) : null);
  return {
    employerPayment: {
      groupBy: async () => {
        const statuses = [...new Set(payments.map((p) => p.status))];
        return statuses.map((status) => {
          const rows = payments.filter((p) => p.status === status);
          return { status, _sum: { amountPaise: sum(rows) }, _count: { _all: rows.length } };
        });
      },
      aggregate: async ({ where }: Row) => ({ _sum: { amountPaise: sum(payments.filter((p) => matches(p, where))) } }),
      findMany: async ({ where }: Row) => {
        const ids = [...new Set(payments.filter((p) => matches(p, where)).map((p) => p.employerId))];
        return ids.map((employerId) => ({ employerId }));
      },
      count: async ({ where }: Row) => payments.filter((p) => matches(p, where)).length,
    },
    employer: { count: async () => 2 },
    employerCandidateView: { count: async () => 5 },
  };
}

const revenue = (payments: Row[]) =>
  new AdminService(fakePrisma(payments) as never, {} as never, {} as never).revenue(NOW);

describe('Revenue — canonical calculation', () => {
  it('zero revenue when there are no payments', async () => {
    const r = await revenue([]);
    assert.equal(r.totalRevenueInr, 0);
    assert.equal(r.revenueThisMonthInr, 0);
    assert.equal(r.paidPayments, 0);
    assert.equal(r.payingEmployers, 0);
    assert.deepEqual(r.bySource, { jobPostingFeesInr: 0, hiringFeesInr: 0, otherInr: 0 });
    assert.deepEqual(r.excluded, {
      pending: { count: 0, amountInr: 0 },
      failed: { count: 0, amountInr: 0 },
      refunded: { count: 0, amountInr: 0 },
    });
    assert.equal(r.currency, 'INR');
    assert.equal(r.period, '2026-10');
  });

  it('counts only PAID payments; pending, failed and refunded are reported but excluded', async () => {
    const r = await revenue([
      payment({ amountPaise: 99900, providerRef: 'job_post:j1' }),
      payment({ amountPaise: 499900, hiringOutcomeId: 'h1' }),
      payment({ amountPaise: 99900, status: 'PENDING', paidAt: null }),
      payment({ amountPaise: 99900, status: 'FAILED', paidAt: null }),
      payment({ amountPaise: 499900, status: 'REFUNDED' }),
    ]);
    assert.equal(r.totalRevenueInr, 5998);
    assert.equal(r.paidPayments, 2);
    assert.equal(r.pendingPayments, 1);
    assert.deepEqual(r.excluded, {
      pending: { count: 1, amountInr: 999 },
      failed: { count: 1, amountInr: 999 },
      refunded: { count: 1, amountInr: 4999 },
    });
  });

  it('splits paid revenue into job posting fees, hiring fees and other', async () => {
    const r = await revenue([
      payment({ amountPaise: 99900, providerRef: 'job_post:j1' }),
      payment({ amountPaise: 99900, providerRef: 'job_post:j2' }),
      payment({ amountPaise: 499900, hiringOutcomeId: 'h1' }),
      payment({ amountPaise: 25000, provider: 'MANUAL' }),
    ]);
    assert.deepEqual(r.bySource, { jobPostingFeesInr: 1998, hiringFeesInr: 4999, otherInr: 250 });
    assert.equal(
      r.bySource.jobPostingFeesInr + r.bySource.hiringFeesInr + r.bySource.otherInr,
      r.totalRevenueInr,
    );
  });

  it('each payment row counts once; ₹0 free-access records add nothing and do not make an employer "paying"', async () => {
    const r = await revenue([
      payment({ employerId: 'free', amountPaise: 0, providerRef: 'job_post:j1', provider: 'FREE' }),
      payment({ employerId: 'free', amountPaise: 0, providerRef: 'job_post:j2', provider: 'FREE' }),
      payment({ employerId: 'e1', amountPaise: 99900, providerRef: 'job_post:j3' }),
      payment({ employerId: 'e1', amountPaise: 99900, providerRef: 'job_post:j4' }),
    ]);
    assert.equal(r.totalRevenueInr, 1998);
    assert.equal(r.paidPayments, 4);
    assert.equal(r.freePaidPayments, 2);
    assert.equal(r.payingEmployers, 1);
  });

  it('this month uses the India-time calendar month of paidAt', async () => {
    const r = await revenue([
      payment({ amountPaise: 10000, paidAt: IN_MONTH }),
      payment({ amountPaise: 20000, paidAt: BEFORE_MONTH }),
    ]);
    assert.equal(r.totalRevenueInr, 300);
    assert.equal(r.revenueThisMonthInr, 100);
  });

  it('keeps the existing response fields (Reports Revenue panel compatibility)', async () => {
    const r = await revenue([]);
    for (const key of [
      'period',
      'currency',
      'totalRevenueInr',
      'revenueThisMonthInr',
      'paidPayments',
      'pendingPayments',
      'payingEmployers',
      'newEmployersThisMonth',
      'creditsConsumedThisMonth',
      'paymentGatewayConfigured',
      'note',
    ]) {
      assert.ok(key in r, key);
    }
    assert.equal(r.definition, REVENUE_DEFINITION);
    assert.equal(r.newEmployersThisMonth, 2);
    assert.equal(r.creditsConsumedThisMonth, 5);
  });

  it('helpers convert paise and never report negative "other" revenue', () => {
    assert.equal(paiseToInr(null), 0);
    assert.equal(paiseToInr(12345), 123.45);
    assert.deepEqual(bucketFor([], 'FAILED'), { count: 0, amountInr: 0 });
    assert.equal(revenueBySource({ totalPaise: 100, jobPostingPaise: 100, hiringFeePaise: 100 }).otherInr, 0);
  });

  it('the revenue route keeps its Super Admin / Admin access', () => {
    assert.deepEqual(
      [...(Reflect.getMetadata(ROLES_KEY, (AdminController.prototype as any).revenue) as string[])].sort(),
      ['PLATFORM_ADMIN', 'SUPER_ADMIN'],
    );
  });
});
