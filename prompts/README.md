# 프롬프트 모음

AssetTrail 데이터를 AI로 분석·점검할 때 쓰는 프롬프트를 모아둔 폴더다.
설정 → 데이터 내보내기로 받은 JSON과 함께 사용한다.

## 목록

| 파일 | 용도 | 필요한 데이터 |
| --- | --- | --- |
| [매매일지-분석.md](매매일지-분석.md) | 매매 스타일·잘한 점·잘못한 점·개선 행동 복기 | `tradeJournalEntries`, `realizedTrades` |
| [포트폴리오-리뷰.md](포트폴리오-리뷰.md) | 자산배분·집중도·보유 자산 역할·리밸런싱 우선순위 점검 | `assets`, `snapshots`, `realizedTrades`, `tradeJournalEntries`, `retirement` |
| [은퇴가정-점검.md](은퇴가정-점검.md) | FIRE 관점에서 은퇴 시점·지출·수익률·인출률·현금흐름 가정 점검 | `retirement`, `retirementScenarios`, `assets`, `snapshots` |

## 추가 규칙

- 파일 이름은 용도가 드러나게 짓는다. 예: `매매일지-분석.md`, `포트폴리오-점검.md`. 같은 주제를 시점별로 남길 때는 `YYYY-MM-DD-주제.md`.
- 새 프롬프트를 추가하면 위 표에 한 줄 추가한다.
- 각 파일은 머리말에 사용법(어떤 내보내기와 함께 쓰는지, AI가 볼 핵심 키)을 짧게 적고, 그 아래에 프롬프트 본문을 둔다.

## 민감 정보 주의

전체 내보내기 JSON에는 매매와 무관한 민감 정보가 함께 들어 있다.
외부 AI 서비스에 붙여넣는 게 신경 쓰이면 아래 블록을 지워도 매매 분석에는 지장이 없다.

- `snapshots` — 총자산 추이
- `retirement`, `retirementScenarios` — 나이·은퇴 시점·월 지출/투자 가정
- `assets`의 평가금액
