import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  amountInWordsInr,
  computeSubscriptionGst,
  gstinStateCode,
} from './employer-subscription-gst';

describe('subscription GST', () => {
  it('adds 18% exclusive GST on catalogue amount', () => {
    const g = computeSubscriptionGst(99900, '27AAPFU0939F1ZV');
    assert.equal(g.taxablePaise, 99900);
    assert.equal(g.gstPaise, 17982);
    assert.equal(g.totalPaise, 117882);
    assert.equal(g.taxMode, 'IGST');
    assert.equal(g.igstPaise, 17982);
  });

  it('splits CGST+SGST for Karnataka buyer (29)', () => {
    const g = computeSubscriptionGst(99900, '29ABQCS9374K1Z6');
    assert.equal(g.taxMode, 'CGST_SGST');
    assert.equal(g.cgstPaise + g.sgstPaise, g.gstPaise);
    assert.equal(g.igstPaise, 0);
  });

  it('uses Karnataka state hint when GSTIN is missing', () => {
    const g = computeSubscriptionGst(100, null, 'Karnataka');
    assert.equal(g.taxMode, 'CGST_SGST');
    assert.equal(g.buyerStateCode, '29');
    assert.equal(g.cgstPaise + g.sgstPaise, g.gstPaise);
  });

  it('treats Bengaluru city hint as Karnataka (CGST+SGST)', () => {
    const g = computeSubscriptionGst(100, null, 'Bengaluru');
    assert.equal(g.taxMode, 'CGST_SGST');
    assert.equal(g.buyerStateCode, '29');
  });

  it('reads state from GSTIN', () => {
    assert.equal(gstinStateCode('29ABQCS9374K1Z6'), '29');
    assert.equal(gstinStateCode(null), null);
  });

  it('formats amount in words', () => {
    assert.match(amountInWordsInr(117882), /Rupees/i);
    assert.match(amountInWordsInr(100), /One Rupee/i);
  });
});
