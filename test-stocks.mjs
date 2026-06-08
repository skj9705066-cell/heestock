// 4종목 비교 테스트
const stocks = [
  { symbol: '005930', name: '삼성전자', market: 'KR' },
  { symbol: '066570', name: 'LG전자', market: 'KR' },
  { symbol: '000150', name: '두산', market: 'KR' },
  { symbol: '440110', name: '파두', market: 'KR' },
];

console.log('=== 4종목 KIS 호출 테스트 ===\n');

for (const stock of stocks) {
  const url = `http://localhost:3000/api/stock-snapshot?symbol=${stock.symbol}&market=${stock.market}&v=2.1&_t=${Date.now()}`;
  console.log(`\n>>> ${stock.name}(${stock.symbol}) 테스트 시작`);
  console.log(`URL: ${url}`);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.quote) {
      console.log(`✓ 성공: price=${data.quote.price}, changePercent=${data.quote.changePercent}%`);
    } else {
      console.log(`✗ 실패: quote 없음`);
      console.log(`Errors: ${data.errors?.join(', ') || 'N/A'}`);
    }
  } catch (err) {
    console.log(`✗ 에러: ${err.message}`);
  }
}

console.log('\n=== 테스트 완료 ===');
