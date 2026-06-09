// 전역 클라이언트 요청 직렬화 큐.
//
// 문제: 관심종목 카드들이 동시에 mount하면서 각자 /api/stock-snapshot,
// /api/daily-candles 를 한꺼번에 발사 → 서버가 KIS Open API를 짧은 시간에
// 몰아 호출 → KIS 초당 호출제한에 걸려 일부 종목의 quote가 누락(200 + quote:null).
//
// 해결: 모든 카드의 fetch를 이 큐로 통과시켜 한 번에 하나씩, 최소 간격을 두고
// 순차 실행한다. 화면 호출 경로는 그대로(같은 엔드포인트), 발사 타이밍만 분산.

type Task<T> = () => Promise<T>;

// KIS 초당 제한 회피용 요청 시작 간 최소 간격(ms).
const MIN_GAP_MS = 500;
// 한 작업이 멈춰도 큐 전체가 영구히 막히지 않도록, 이 시간이 지나면 다음 작업을 진행.
const MAX_TASK_MS = 20_000;

let chain: Promise<unknown> = Promise.resolve();
let lastStart = 0;

/**
 * task 를 전역 큐에 넣고, 직전 작업이 끝난 뒤(성공/실패 무관) MIN_GAP_MS 간격을
 * 보장한 다음 실행한다. task 자체의 결과(또는 예외)는 호출자에게 그대로 전달된다.
 */
export function enqueue<T>(task: Task<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const gap = MIN_GAP_MS - (Date.now() - lastStart);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    lastStart = Date.now();
    return task();
  };

  // 이전 작업의 성공/실패와 무관하게 다음 작업을 이어서 실행.
  const result = chain.then(run, run);
  // 체인이 거부로 끊기지 않도록 결과를 삼키고, 작업이 멈춰도 MAX_TASK_MS 후
  // 다음 작업이 진행되도록 타임아웃과 경합시킨 꼬리를 다음 체인으로 사용.
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  chain = Promise.race([
    settled,
    new Promise<void>((r) => setTimeout(r, MAX_TASK_MS)),
  ]);
  return result;
}
