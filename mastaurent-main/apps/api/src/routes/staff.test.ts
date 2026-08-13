import { describe, expect, it } from 'vitest';
import { accountLookup } from './staff.js';

describe('accountLookup', () => {
  it('и-мэйлийг том/жижиг үсэг ялгалгүй хайна', () => {
    expect(accountLookup('  Bat@Example.COM ')).toEqual({
      email: { equals: 'Bat@Example.COM' },
    });
  });

  it('утсыг ямар ч хэлбэрээр бичсэн ижил 8 орон болгоно', () => {
    const expected = { phone: { endsWith: '88746068' } };
    for (const input of ['88746068', '+97688746068', '976 8874 6068', '+976-8874-6068', ' 8874-6068 ']) {
      expect(accountLookup(input), input).toEqual(expected);
    }
  });

  it('976-аар эхэлсэн ЖИНХЭНЭ 8 оронтой дугаарыг мохоохгүй', () => {
    // Урд нь `^\+?976`-г таслдаг байсан нь үүнийг `12345` болгодог байв.
    expect(accountLookup('97612345')).toEqual({ phone: { endsWith: '97612345' } });
  });

  it('8 оронд хүрэхгүй утгыг хайлт болгохгүй', () => {
    expect(accountLookup('8874')).toBeNull();
    expect(accountLookup('---')).toBeNull();
  });
});
