# Phase B 完了レポート

## 概要

Phase B は「PR-B3 で改善された正規化ロジックを DB に適用し、Work の重複検出精度を向上させる」ことを目的として実施された。

**実施期間**: 2026-05-02 〜 2026-05-03

## 最終 DB 状態

| 指標 | Phase A 完了時 | Phase B 完了時 | 変化 |
|---|---|---|---|
| Work | 14,007 | **13,998** | -9 (auto_merge) |
| MergeSuggestion | 1,523 | **1,913** | +390 (新規候補) |
| ReadingStatus | 1 件 (READING, page=90) | **不変** | — |
| テスト | 90 | **150** | +60 |

## PR 一覧

### PR-B1: parseAuthorField for translator separation
- `parseAuthorField()` 関数を新規実装
- 原著者と翻訳者の分離: "ドストエフスキー/亀山郁夫訳" → authors + translators
- 共著者の分割、「名前/役割」形式の検出、カンマ姓名判定
- 21 テストケース追加

### PR-B2: Roman numeral volume extraction
- `normalizeTitle` にローマ数字 (II-X) の巻数抽出を追加
- 全角ローマ数字 (Ⅱ-Ⅹ) 対応 (NFKC)
- 単独 I の安全な処理方針確立
- 25 テストケース + 3 マッチングテスト追加

### PR-B3: DB renormalization (13,994 Work 更新)
- `scripts/renormalize-works.ts` で全 Work の titleNormalized / authorNormalized を更新
- parseAuthorField で原著者のみを authorNormalized に格納
- ローマ数字巻数の titleNormalized からの除去
- dry-run → レビュー → 本実行 → 検証の厳密なフロー
- `scripts/verify-renormalize.ts` で機械的検証

### PR-B4: calculateMatchScore uses DB authorNormalized
- `BookCandidate` に `authorNormalized?` / `titleNormalized?` を追加
- `calculateMatchScore` が DB 保存済みの正規化値を使用 (フォールバック付き)
- 翻訳違い同作品のスコア: 0.10 → 0.98 に改善
- 6 テストケース追加

### PR-B5: conservative-mode batch matching (402 suggest_merge 登録)
- conservative-mode で batch-matching.ts を本実行
- 402 件の新規 MergeSuggestion を登録 (auto_merge: 0)
- JIS ハンドブックのページ数差保険チェック実装
- 4 テストケース追加

### PR-B6: conservative-mode なし dry-run (問題発見)
- dry-run のみ実行 (本実行なし)
- auto_merge 24 件中 15 件 (62%) がシリーズ別巻の誤統合候補と発見
- 原因特定: volume 片方 null + スコア 0.95 が高すぎる

### PR-B7: Volume pattern expansion + batch matching (9 Work 統合)
- 角括弧 `[II]` `[III]` の volume 抽出パターン追加
- 修飾語前ローマ数字パターン追加
- 一方だけ volume ありのスコア: 0.95 → 0.85 (suggest_merge に降格)
- auto_merge: 24 → 9 件、正当率: 29% → 89%
- 本実行で 9 Work を統合

## 主要な学習ポイント

### 1. calculateMatchScore が DB 値を使っていなかった (PR-B4)

Phase B の最重要発見。`calculateMatchScore` は raw author 全文を `normalizeAuthor` に渡しており、PR-B3 で更新した authorNormalized (parseAuthorField 適用済み) を使っていなかった。これにより翻訳違いの同作品がスコア 0.10 (separate) と誤判定されていた。

**教訓**: DB に保存した正規化値と実行時計算の値が乖離していないか、定期的に検証すべき。

### 2. conservative-mode なしの誤統合リスク (PR-B6)

conservative-mode を外すと 62% が誤統合候補になった。原因は「シリーズ第1巻にはタイトルに巻数が付かない」パターン。

**教訓**: 段階的な mode 緩和 (conservative → normal) を dry-run で検証してから本実行する Phase A の方針が正しかった。

### 3. parseAuthorField の「/著」形式検出 (PR-B3 修正)

初回 dry-run で "マーク・エヴァン・ボンズ/著 土田英三郎/翻訳" が正しく処理されず、translator に残骸が混入。`tryParseNameRoleFormat` の実装で解決。

**教訓**: 日本の書誌データは「名前/役割 名前/役割」形式が一般的。このパターンを最優先で検出すべき。

### 4. テストファーストの重要性

- M1 テスト (ノルウェイの森 単行本 vs 文庫) が PR-B7 のスコア変更で失敗 → 設計の意図変更を明示的に認識できた
- dry-run → レビュー → 本実行のフローが誤統合を防いだ

## 残課題

### Phase C 対応

1. **TranslationGroup 自動振り分け**: parseAuthorField の translators 情報を TranslationGroup に保存
2. **UI 調整**: Work ページでの TranslationGroup 表示

### 将来対応

3. **著名翻訳書の巻数違い**: 「カラマーゾフの兄弟 1」vs「カラマーゾフの兄弟（上）」— DB にそもそも複数版が存在しない
4. **1,913 件の MergeSuggestion レビュー**: 管理画面で人間判断
5. **authorNormalized に「訳」残留 42 件**: 翻訳者のみ・複合役割の未対応ケース
6. **「単行本 vs 分冊（上）」**: score 0.85 で suggest_merge に留まる ��� 人間判断
7. **SGS 過去問の年度版統合**: 必要なら管理画面で分離

## ファイル変更サマリ

| ファイル | 変更種別 |
|---|---|
| `lib/normalize-work.ts` | 大幅追加 (parseAuthorField, volume patterns, role detection) |
| `lib/matching.ts` | 修正 (authorNormalized fallback, page ratio check, score 0.95→0.85) |
| `lib/normalize-work.test.ts` | テスト追加 |
| `lib/parse-author-field.test.ts` | 新規作成 |
| `lib/matching-advanced.test.ts` | テスト追加 |
| `lib/matching.test.ts` | テスト期待値修正 |
| `scripts/renormalize-works.ts` | 新規作成 |
| `scripts/verify-renormalize.ts` | 新規作成 |
| `scripts/batch-matching.ts` | 修正 (toCandidate に正規化値追加) |
| `scripts/inspect-extra-merges.ts` | 修正 (同上) |
| `scripts/sample-duplicates.ts` | 修正 (同上) |
| `docs/known-issues.md` | 更新 |
| `docs/phase-b-pr-b3-completion-report.md` | 新規 |
| `docs/phase-b-pr-b5-completion-report.md` | 新規 |
| `docs/phase-b-pr-b7-completion-report.md` | 新規 |
| `docs/phase-b-completion-report.md` | 新規 (本ファイル) |
