import { describe, expect, it } from 'vitest';
import { readShortlistBackup, shortlistBackup, shortlistFileLimit } from './shortlist';

const cars = [{ id: 'honda' }, { id: 'mazda' }];
describe('portable shortlists', () => {
  it('round-trips choices without capturing catalog facts or private garage data', () => {
    const raw = shortlistBackup(['mazda', 'honda']);
    expect(JSON.parse(raw)).toEqual({ version: 1, ids: ['mazda', 'honda'] });
    expect(readShortlistBackup(raw, cars)).toEqual({
      recognized: ['mazda', 'honda'],
      unavailable: [],
    });
    expect(readShortlistBackup(shortlistBackup([]), cars).recognized).toEqual([]);
  });
  it('deduplicates choices in file order and reports unavailable configurations explicitly', () => {
    expect(
      readShortlistBackup(shortlistBackup(['honda', 'old-car', 'honda', 'mazda', 'old-car']), cars),
    ).toEqual({ recognized: ['honda', 'mazda'], unavailable: ['old-car'] });
  });
  it('rejects unreadable or unsupported data instead of silently importing a partial structure', () => {
    for (const data of [
      null,
      [],
      {},
      { version: 2, ids: ['honda'] },
      { version: 1 },
      { version: 1, ids: [42] },
      { version: 1, ids: [''] },
      { version: 1, ids: [' '] },
      { version: 1, ids: ['honda'], extra: true },
      { version: 1, ids: ['x'.repeat(257)] },
    ])
      expect(() => readShortlistBackup(JSON.stringify(data), cars)).toThrow('supported version 1');
    expect(() => readShortlistBackup('{bad', cars)).toThrow('not valid shortlist JSON');
  });
  it('bounds the UTF-8 file size and entry count before resolving catalog identifiers', () => {
    expect(() => readShortlistBackup(' '.repeat(shortlistFileLimit + 1), cars)).toThrow('2 MB');
    expect(() => readShortlistBackup('雪'.repeat(Math.ceil(shortlistFileLimit / 3)), cars)).toThrow(
      '2 MB',
    );
    expect(() => readShortlistBackup(shortlistBackup(Array(20001).fill('honda')), cars)).toThrow(
      'supported version 1',
    );
  });
});
