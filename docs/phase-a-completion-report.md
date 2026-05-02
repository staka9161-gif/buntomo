# Phase A 完了レポート

## 実行日時
- 2026-05-01

## 実行コマンド
```
npx tsx scripts/batch-matching.ts --execute --conservative-mode
```

## 結果サマリ

| 項目 | 値 | 期待値 | 判定 |
|---|---|---|---|
| auto_merge 実行件数 | 650 | 649 | +1 (後述) |
| MergeSuggestion 作成件数 | 44 | 55 程度 | OK (既存ペアと重複した分が少なかった) |
| エラー件数 | 21 | 0 | NG (後述) |
| conservative-mode 降格 | 6 | 10 | OK (一部のバケットは統合済みでスキップ) |
| 保険発動 | 0 | 0 | OK |
| 実行時間 | 約90分 | 20-40分 | Neon レイテンシ |

## ベースラインとの比較

| 項目 | 実行前 (pre) | 実行後 (post) | 差分 | 期待 | 判定 |
|---|---|---|---|---|---|
| 重複グループ数 | 552 | 19 | -533 | 0 | 19 残存 (後述) |
| 余剰 Work 数 | 649 | 20 | -629 | 0 | 20 残存 (後述) |
| 孤児 Work | 0 | 0 | 0 | 0 | OK |
| Work 総数 | 14,656 | 14,027 | -629 | -649 | 20 件未統合 |
| Edition 総数 | 20,808 | 20,808 | 0 | 0 | OK |
| ReadingStatus | 1 件 | 1 件 | diff 0 行 | 0 行 | OK |
| Book.migratedWorkId null | 2 | 2 | 0 | 0 | OK (Phase A スコープ外) |
| Book.migratedWorkId FAILED | 0 | 0 | 0 | 0 | OK |
| MergeSuggestion 件数 | 2,808 | 2,092 | -716 | 変動 | OK (削除+追加の差し引き) |

## エラー 21 件の詳細

全て同じ原因: **トランザクションタイムアウト (30秒超)**

- 対象: 「全国のあいつぐ差別事件」シリーズ各年度版 (2004〜2022年度版、21件)
- 原因: このシリーズは 20 年度分 × 重複 = 多数の MergeSuggestion が存在し、1 トランザクション内の MergeSuggestion 付け替え操作が 30 秒の timeout を超えた
- 影響: 該当する 20 件の重複 Work が未統合のまま残存
- 対応: Phase A のスコープ外。timeout 増加または分割トランザクションで再試行可能

## 残存する重複 19 グループ (20 Work)

タイムアウトで統合できなかった「全国のあいつぐ差別事件」シリーズが主体。
conservative-mode で title+author 完全一致のペアのみ処理したため、
ローマ数字巻数違いの 10 件は MergeSuggestion に降格済み。

## ReadingStatus の安全性

実行前後の ReadingStatus 全件ダンプが完全一致:
- id: cmobi0beb0002lj04gw9wlf1u
- editionId: cmomax5u60415adbspspr9kon (変化なし)
- workId: cmole4ibm0000adhw6i5smj3s (変化なし)
- status: READING, page: 90 (変化なし)

## バックアップファイル

| ファイル | 内容 |
|---|---|
| backups/reading-status-pre-2026-05-01T09-35-24.json | 実行前 ReadingStatus |
| backups/reading-status-post-2026-05-01T11-12-45.json | 実行後 ReadingStatus |
| backups/merge-suggestions-pre-2026-05-01T09-35-24.json | 実行前 MergeSuggestion (675 KB, 2,808件) |
| backups/merge-suggestions-post-2026-05-01T11-12-45.json | 実行後 MergeSuggestion (503 KB, 2,092件) |
| backups/dry-run-output-20260501-183843.log | dry-run ログ |
| backups/execute-output-20260501-185423.log | 本実行ログ (120 KB) |
| backups/extra-merges-2026-05-01T09-49-05.txt | 追加109件の検査結果 |

## 再実行 (タイムアウト案件)

### 実行日時
- 2026-05-01 (初回実行の直後)

### 実行コマンド
```
npx tsx scripts/batch-matching.ts --execute --conservative-mode --timeout-ms 120000
```

### 結果

| 項目 | 値 | 期待値 | 判定 |
|---|---|---|---|
| auto_merge | 20 | 20 | OK |
| MergeSuggestion 作成 | 0 | 0 | OK |
| エラー | 0 | 0 | OK |

### 再実行後の検証 (post-retry)

| 項目 | post | post-retry | 判定 |
|---|---|---|---|
| 重複グループ数 | 19 | **0** | OK |
| 余剰 Work 数 | 20 | **0** | OK |
| 孤児 Work | 0 | 0 | OK |
| Work 総数 | 14,027 | **14,007** | -20 (期待通り) |
| Edition 総数 | 20,808 | 20,808 | 変化なし |
| ReadingStatus | diff 0 行 | diff 0 行 | 完全一致維持 |
| MergeSuggestion | 2,092 | **1,523** | -569 (付け替え時の重複削除) |

## Phase A 最終ステータス

**完了。**

| 指標 | 値 |
|---|---|
| 総統合件数 | **649** (初回 629 + 再実行 20) |
| 最終 Work 数 | **14,007** |
| 最終 Edition 数 | **20,808** |
| Edition/Work 比 | **1.49** |
| 残存重複グループ | **0** |
| 残存余剰 Work | **0** |
| ReadingStatus 影響 | **なし** (全フェーズ通じて diff 0 行) |

## 次の Phase への引き継ぎ

- Phase B: 著者正規化修正 + 原著者ベースでの Work 再統合
- ローマ数字巻数パターンの追加も Phase B
- docs/known-issues.md に記録済み
