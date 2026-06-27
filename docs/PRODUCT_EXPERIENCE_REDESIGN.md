# AssetTrail Product Experience Redesign

## Summary

AssetTrail is not a daily return app or an investment recommendation tool. It is a personal investment ledger that connects current assets, asset changes, investment decisions, portfolio balance, history, and retirement goals.

The redesign principle is:

`current -> change -> decision -> portfolio -> long-term goal`

The current product already has strong functional depth, but the experience still feels like a long bundle of tools. The next product step is to turn those tools into a guided investment journey.

## 1. UX Analysis

### Information Structure

Current structure:

- Summary metrics
- Asset ledger
- Investment records
- Portfolio analysis
- History
- Retirement simulator

This is logical from an implementation perspective, but not from a user journey perspective. The user needs to know what changed, what needs attention, and what action should come next. Right now every feature competes in one vertical stream.

Recommended structure:

- Dashboard: today, change, attention items
- Assets: ledger, buy, sell, asset detail
- Journal: investment decisions and realized profit/loss
- Portfolio: allocation, target gaps, rebalancing hints
- Goals: history and retirement planning
- Settings: cloud sync, prices, import/export, dangerous actions

### First Impression

The first impression is feature-rich but heavy. A user can see that the app is powerful, but it takes effort to understand where to start.

Priority:

- P0: Make the dashboard answer immediate questions.
- P0: Make mobile navigation explicit.
- P1: Move system actions such as sync/import/export into Settings or a quieter status area.

### Cognitive Load

The current UI shows too many categories at once: assets, journal, realized P/L, allocation, history, retirement. This creates a scanning burden, especially on mobile.

Priority:

- P0: Split major sections into app views.
- P1: Add "today to review" as a behavioral guide.
- P1: Add asset detail instead of forcing all detail into the ledger row.

### Financial Trust

Trust is mostly achieved through data transparency: prices, cloud status, snapshots, realized records. The visual language should support that trust by becoming quieter and more consistent.

Priority:

- P1: Use restrained color tokens.
- P1: Standardize cards, badges, table actions, dialogs, and toast messages.
- P2: Reduce decorative styles that do not clarify data.

### Navigation

Current navigation depends on vertical scrolling. On desktop this is usable but tiring; on mobile it becomes the largest product problem.

Priority:

- P0: Add top app navigation on desktop.
- P0: Add bottom navigation on mobile.
- P1: Let Dashboard act as a summary and entry point.

### CTA Clarity

Many actions are available, but they are feature labels rather than user-intent labels.

Examples:

- `저장` -> `투자 기록 저장`
- `자산 추가` -> `새 자산 등록`
- `조회 기록 저장` -> `오늘 자산 기록 남기기`
- `Sync` -> `클라우드 동기화`
- `가격 갱신` -> `최신 가격 확인`

## 2. Core User Scenarios

### First Visit

1. Understand the service: "my investment journey, not a recommendation app."
2. Choose cloud login or local use.
3. Register the first asset.
4. See first portfolio summary.
5. Save the first snapshot.

### Repeat Visit

1. Check current total assets.
2. See change since last snapshot.
3. Review today's attention items: missing prices, portfolio drift, journal reviews.
4. Enter the relevant area: Assets, Journal, Portfolio, or Goals.
5. Save today's asset snapshot.

### After a Trade

1. Open the asset.
2. Record additional buy or sell.
3. Realized P/L is generated automatically for sells.
4. A linked journal entry is created by default.
5. Portfolio allocation updates.
6. User reviews whether the trade matches the plan.

### Long-Term Check

1. Open Goals.
2. Review asset history.
3. Compare retirement target progress.
4. Adjust scenario.
5. Decide what to monitor next.

## 3. Main Dashboard Redesign

The dashboard should answer six questions immediately:

- What is my current total asset value?
- How much did it change recently?
- What is the largest portfolio weight?
- How close am I to the long-term goal?
- What are my recent investment records?
- What should I review today?

Recommended dashboard modules:

- Hero metric: current total assets and recent change
- Goal progress card: retirement progress and shortage
- Largest weight card: dominant category/account/asset
- Today to review: missing prices, drift, journal reviews
- Recent investment records: latest journal and realized trade
- Portfolio snapshot: weight bars, not a dense chart

## 4. Screen Redesigns

### Dashboard

Purpose: give the user a calm daily overview.

Core information:

- Total assets
- Recent change
- Goal progress
- Largest allocation
- Today to review
- Recent records

User actions:

- Review today
- Register asset
- Save snapshot
- Go to portfolio or goals

UI components:

- Metric cards
- Attention card
- Recent record list
- Allocation bars
- Primary CTA

### Asset Ledger

Purpose: manage current holdings and asset-level actions.

Core information:

- Asset name, account, type, ticker
- Quantity and average price
- Evaluation amount
- Gain/loss
- Price status

User actions:

- Register new asset
- Add buy
- Sell
- Write journal
- Open asset detail

UI components:

- Desktop table
- Mobile asset cards
- Segmented filters
- Search
- Action buttons
- Price status badge

### Asset Detail

Purpose: explain one asset's full story.

Core information:

- Holding summary
- Cost basis
- Current valuation
- Related buy/sell records
- Related journal entries
- Portfolio weight

User actions:

- Add buy
- Sell
- Write journal
- Edit asset

UI components:

- Detail header
- Metric grid
- Transaction list
- Journal list
- Allocation context

### Portfolio Analysis

Purpose: answer "is my portfolio close to my target?"

Core information:

- Domestic/US/manual/cash weights
- Product type weights
- Account weights
- Target gaps

User actions:

- Edit target weights
- Review over/underweight areas
- Open related assets

UI components:

- Weight bars
- Target gap cards
- Compact charts
- Rebalance summary

### Investment Journal

Purpose: connect trade records with decision-making.

Core information:

- Buy/sell/watch/rebalance entries
- Reason
- Risk
- Review memo
- Linked realized P/L
- Status and tags

User actions:

- Write journal
- Review existing decision
- Open realized trade
- Copy AI review prompt

UI components:

- Journal timeline
- Compact cards
- Filters
- Linked realized badge
- Review status tag

### History

Purpose: show how the asset trail changed over time.

Core information:

- Snapshot total
- Change from previous snapshot
- Period trend
- Key inflection points

User actions:

- Save today's snapshot
- Filter range
- Delete snapshot with confirmation

UI components:

- Line/area chart
- Snapshot summary
- Snapshot table
- Confirm dialog

### Retirement Planner

Purpose: connect current assets to long-term goals.

Core information:

- Required nest egg
- Current progress
- Shortage
- Required return with/without monthly contribution
- Scenario comparison

User actions:

- Apply current assets
- Save scenario
- Load scenario
- Adjust assumptions

UI components:

- Progress card
- Scenario presets
- Inputs
- Result cards
- Sensitivity cards

### Settings

Purpose: move operational controls out of the main journey.

Core information:

- Login status
- Cloud sync status
- Price file status
- Import/export
- Data risk actions

User actions:

- Login/logout
- Cloud sync
- Refresh prices
- Export data
- Import data

UI components:

- Status list
- System buttons
- Danger zone
- Toasts

## 5. Design System

### Tokens

```css
:root {
  --color-ink: #111827;
  --color-slate: #64748b;
  --color-surface: #ffffff;
  --color-surface-muted: #f8fafc;
  --color-background: #f5f7fb;
  --color-line: #e2e8f0;
  --color-blue: #2563eb;
  --color-green: #059669;
  --color-red: #dc2626;
  --color-amber: #d97706;
  --radius-1: 8px;
  --radius-2: 12px;
  --radius-3: 16px;
  --radius-4: 24px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --shadow-card: 0 18px 42px rgba(15, 23, 42, 0.07);
  --shadow-floating: 0 24px 60px rgba(15, 23, 42, 0.10);
}
```

### Typography

- Display: 40-48px, bold, dashboard total only
- Section title: 22-26px, bold
- Card title: 15-18px, bold
- Body: 14-16px, medium
- Caption: 12-13px, medium
- Amount: bold, tabular alignment where possible

### Components

- Button: primary, secondary, quiet, danger
- Input: label + helper + error state
- Table: sticky header, numeric right alignment
- Card: 16-24px radius, subtle border, low shadow
- Badge: market, status, risk, linked realized P/L
- Tag: journal topics and review status
- Empty state: user action plus reassurance
- Chart: muted grid, direct labels, restrained colors
- Dialog: destructive confirmations, sell/buy flows
- Bottom sheet: mobile forms
- Toast: save, sync, undo
- Navigation: top nav desktop, bottom nav mobile

## 6. Chart and Data Visualization

Recommended chart rules:

- Asset change: line/area chart with period labels and notable snapshot markers
- Portfolio weight: horizontal bars as default, donut only for compact overview
- Target gap: current vs target bars with shortage/excess labels
- Retirement goal: progress bar plus shortage amount
- Realized P/L: monthly bars with positive/negative colors

The user should be able to understand the chart without reading a legend first.

## 7. Microcopy

Recommended copy:

- `자산 추가` -> `새 자산 등록`
- `조회 기록 저장` -> `오늘 자산 기록 남기기`
- `가격 갱신` -> `최신 가격 확인`
- `Sync` -> `클라우드 동기화`
- `Export` -> `데이터 내보내기`
- `Import` -> `데이터 가져오기`
- `일지 저장` -> `투자 판단 저장`
- `히스토리 비우기` -> `조회 기록 전체 삭제`
- `매도 기록 저장` -> `매도와 손익 기록 저장`

## 8. Mobile UX

Mobile must not be a squeezed desktop table.

Rules:

- Bottom navigation for primary areas
- One primary question per screen
- Asset cards instead of table rows
- Sticky primary CTA for asset registration or record save
- Forms should become bottom sheets when React migration begins
- Touch targets should be at least 44px high
- Long account names and asset names must wrap without breaking amounts

## 9. React and Tailwind Implementation

Recommended structure:

```text
src/
  app/
    App.tsx
    routes.tsx
  components/
    ui/
      Button.tsx
      Card.tsx
      Badge.tsx
      Input.tsx
      Table.tsx
      Dialog.tsx
      BottomSheet.tsx
      Toast.tsx
      ChartCard.tsx
  features/
    assets/
    journal/
    portfolio/
    history/
    retirement/
    settings/
  services/
    priceService.ts
    cloudService.ts
    storageService.ts
    portfolioService.ts
    tradeService.ts
  styles/
    tokens.ts
```

Migration order:

1. Add navigation and product shell to current app.
2. Extract price/cloud/storage services.
3. Scaffold Vite + React + Tailwind.
4. Move Dashboard first.
5. Move Assets, Journal, Portfolio, Goals, Settings one by one.
6. Preserve tests and verify each scenario.

## 10. Top 20 Improvements

| Priority | Improvement | Expected Effect |
|---|---|---|
| 1 | Mobile bottom navigation | Major navigation clarity |
| 2 | Dashboard as summary/entry point | Better first impression |
| 3 | Today to review card | Clear next action |
| 4 | Asset detail screen | Ledger density reduction |
| 5 | Trade + journal integration | Stronger product identity |
| 6 | Target gap portfolio analysis | Better decisions |
| 7 | Goals screen for history/retirement | Clear long-term flow |
| 8 | History as change narrative | Better asset trail understanding |
| 9 | Financial microcopy | More trust |
| 10 | Move import/export/sync to Settings | Less topbar noise |
| 11 | Quieter price status | Lower cognitive load |
| 12 | Reduce dashboard card count | Stronger focus |
| 13 | Standardized components | More premium feel |
| 14 | Mobile sticky CTA | Better one-hand use |
| 15 | Dialog/bottom sheet rules | More stable flows |
| 16 | Better empty states | Easier onboarding |
| 17 | Goal progress visualization | More motivation |
| 18 | Chart color rules | Easier interpretation |
| 19 | Journal status/tag system | Better reflection |
| 20 | React/Tailwind migration | Better maintainability |

