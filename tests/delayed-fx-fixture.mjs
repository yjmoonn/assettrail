export const syntheticUser = 'delayed-fx-browser-test';
export const syntheticState = {
  assets: [{ id: 'synthetic-us', name: '미국 테스트', account: '검증용 계좌', type: 'US', ticker: 'AAPL', quantity: 2, averagePrice: 80 }],
  snapshots: [{ id: 'prior-synthetic', createdAt: '2026-07-28T01:00:00Z', total: 250000, note: '기존 기록' }], retirement: {}
};
export function manifest({ actual = '2026-07-29', rate = 1300, delayed = true } = {}) {
  return {
    generatedAt: '2026-07-30T00:00:00Z',
    methodology: { priceBasis: 'unadjusted_close', distributionTreatment: 'excluded', valuationTiming: 'LATEST_COMPLETED_SESSION' },
    finalCloseCertificate: {
      status: delayed ? 'PARTIAL_FINAL_CLOSE' : 'FINAL_CLOSE', checkedAt: '2026-07-30T00:00:00Z', validUntil: '2026-07-31T00:00:00Z',
      expectedFxSession: delayed ? '2026-07-30' : null,
      validUntilByMarket: { KRX: '2026-07-31T00:00:00Z', US: '2026-07-31T00:00:00Z', FX: delayed ? null : '2026-07-31T00:00:00Z' },
      marketSessions: { KRX: '2026-07-30', US: '2026-07-30', FX: delayed ? null : '2026-07-30' }
    },
    fx: { USDKRW: { date: actual, rate, source: 'yfinance KRW=X', sessionStatus: delayed ? 'DELAYED_CLOSE' : 'FINAL_CLOSE', freshnessStatus: delayed ? 'DELAYED' : 'CURRENT', expectedSession: '2026-07-30', retrievedAt: '2026-07-30T00:00:01Z' } },
    prices: { KRX: {}, US: { AAPL: { close: 100, date: '2026-07-30', sessionStatus: 'FINAL_CLOSE' } } }, errors: []
  };
}
