import { describe, expect, it } from 'vitest';
import { toMinorUnit } from './stripe.js';

/**
 * Stripe дүнг хамгийн жижиг нэгжээр авдаг. Буруу хөрвүүлбэл
 * хэрэглэгчээс 100 дахин их/бага мөнгө авах эрсдэлтэй.
 */
describe('toMinorUnit', () => {
  it('MNT-г мөнгө болгож 100-аар үржүүлнэ', () => {
    expect(toMinorUnit(21000, 'mnt')).toBe(2_100_000);
  });

  it('тэг аравтын валютыг хэвээр үлдээнэ', () => {
    expect(toMinorUnit(21000, 'jpy')).toBe(21000);
    expect(toMinorUnit(21000, 'krw')).toBe(21000);
  });

  it('USD-г цент болгоно', () => {
    expect(toMinorUnit(10, 'usd')).toBe(1000);
  });

  it('тэг дүнг зөв дамжуулна', () => {
    expect(toMinorUnit(0, 'mnt')).toBe(0);
    expect(toMinorUnit(0, 'jpy')).toBe(0);
  });
});
