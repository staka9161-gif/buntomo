## 既知の問題

### Book.migratedWorkId null 2件
- 検出日: 2026-05-01
- Phase: A 開始時点のベースライン
- 前回完了報告との矛盾: 前回 Phase A で「残り 0」と報告されたが今回 2 件検出された
- 影響: Phase A スコープ外、Phase B 以降で扱う
- 該当 Book ID:
  - `cmommouha0000ky04so8fd4yq` — 「大活字本シリーズ 太宰治③ 斜陽」(ISBN: 9784862514547, 著者: 太宰 治)
  - `cmommoui60001ky04871xga6l` — 「The Setting Sun」(ISBN: 9781784350833, 著者: Osamu Dazai)
- 推定原因: 移行スクリプト完了後にユーザーの書籍検索等で新たに Book が作成された、または複数の移行スクリプト間のレースコンディションで漏れた

### normalizeTitle の巻数抽出にローマ数字が含まれていない
- 検出日: 2026-05-01
- 影響: ローマ数字で巻数が表記された別巻同士が高スコアでマッチする
- Phase A での回避策: --conservative-mode で title+author 完全一致のみ auto_merge する
- 恒久対応: Phase B で normalizeTitle を修正し、I/II/III/IV/V/VI/VII/VIII/IX/X などのローマ数字パターンを追加。実行時は大文字小文字両対応にすること
- 該当ペア例: "...基礎I" vs "...基礎II"、"日韓国交正常化I" vs "...II"、"現代日本会計学説批判II" vs "...III" など
- 検出スクリプト: scripts/inspect-extra-merges.ts で全件確認可能
