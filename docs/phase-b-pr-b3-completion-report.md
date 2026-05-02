# PR-B3 完了レポート: DB 再正規化

## 実行概要

| 項目 | 値 |
|---|---|
| 実行日時 | 2026-05-02 17:21〜18:17 (JST) |
| 実行コマンド | `npx tsx scripts/renormalize-works.ts --execute --dump-all` |
| 追加実行 | `npx tsx scripts/renormalize-works.ts --execute` (editors fallback 修正後) |
| 対象 Work 総数 | 14,007 件 |
| 更新 Work 数 (1回目) | 12,866 件 |
| 更新 Work 数 (2回目) | 1,128 件 |
| エラー件数 | 0 件 |
| 実行時間 (1回目) | 約 55 分 (Neon free tier の latency による) |
| 実行時間 (2回目) | 約 2 分 |

## パターン別件数

### 1回目 (12,866 件)

| パターン | 件数 |
|---|---|
| translatorSeparation | 2,754 |
| romanNumeral | 438 |
| both | 82 |
| other (titleNormalized 正規化差分) | 9,592 |

### 2回目 (1,128 件 — editors fallback 修正後)

| パターン | 件数 |
|---|---|
| translatorSeparation | 134 |
| other | 994 |

## 検証結果

### verify-renormalize.ts

- 1回目: 12,866 件一致、不一致 0 件 ✓
- 2回目: 1,128 件一致、不一致 0 件 ✓

### authorNormalized に「訳」残留

- 1回目実行後: 176 件
- 2回目実行後: **42 件** (editors fallback 修正で 134 件解消)
- 残 42 件の内訳:
  - 人名に「訳」を含む正当なケース: ~5 件 (「新改訳聖書刊行会」等)
  - 翻訳者のみで著者不在のケース: ~30 件 (「岡崎由美/翻訳 松浦智子/翻訳」等)
  - 複合役割 `/著・訳` `/編訳` の未対応: ~7 件
- **影響**: バッチマッチングの authorNormalized 照合に軽微な影響あり。PR-B4 で対応予定。

### 著名翻訳書スポットチェック

| 作品 | Work.author | authorNormalized | 正しいか |
|---|---|---|---|
| 罪と罰 | ドストエフスキー | ドストエフスキイ | ✓ |
| 変身 掟の前で 他2編 | Kafka,Franz/著 丘沢静也/翻訳 | KAFKAFRANZ | ✓ |
| エリアス・カネッティ 変身と同一 | Y.イシャグプール/著 川俣晃自/訳 | Yイシャグプウル | ✓ |

## バックアップファイル

| ファイル | サイズ | 用途 |
|---|---|---|
| `backups/renormalize-pre-2026-05-02T08-21-36.json` | 2.4 MB | 1回目ロールバック用 |
| `backups/renormalize-expected-2026-05-02T08-21-36.json` | 2.5 MB | 1回目検証用期待値 |
| `backups/renormalize-pre-2026-05-02T09-21-15.json` | — | 2回目ロールバック用 |
| `backups/renormalize-expected-2026-05-02T09-21-15.json` | — | 2回目検証用期待値 |
| `backups/renormalize-dry-run-2026-05-02T08-21-36.json` | 9.8 MB | dry-run 構造化ダンプ |

## 2回目実行の経緯

1回目実行後の検証で、`parseAuthorField` が全員 `/編` や `/翻訳` のケース（著者不在）で `authors: []` を返し、フォールバックで Work.author 全文が normalizeAuthor に渡されてスラッシュが残る問題を検出。

修正: `primaryAuthor = parsed.authors[0] || parsed.editors[0] || work.author` のフォールバック順序追加。

## 既知の制約

1. parsedAuthors にカンマが残るが normalizeAuthor で除去されるため実害なし
2. authorNormalized に「訳」が残る 42 件（翻訳者のみ・複合役割の未対応）
3. authorKana の翻訳者込み判定 (kana 無視) が 1 件のみ有効 (実害なし)

上記はすべて docs/known-issues.md に記録済み。

## PR-B4 への影響

- `batch-matching.ts` のコード変更は不要
- 再正規化により、同じ原著者の翻訳書が同一バケットに入るようになる
- conservative-mode で raw author 不一致は suggest_merge に降格される (期待動作)
- Phase A での auto_merge: 649 件。PR-B4 で追加 50-200 件の auto_merge が見込まれる
