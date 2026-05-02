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
- **対応済み**: PR-B2 で修正完了

### authorKana の翻訳者込み判定 (kana 無視ロジック) の限界
- 検出日: 2026-05-02
- Phase: B (PR-B3 dry-run で検出)
- 内容: authorKana に「ヤク」「ホンヤク」を含む、またはスラッシュを含む場合に kana を無視する判定ロジックを実装したが、実データでは authorKana がローマ字形式 (例: "Bougainville, Louis-Antoine de, comte") で格納されている翻訳書が多く、日本語の「ヤク」を含まないためフィルタが効かない
- 影響: 実害なし。authorKana がローマ字の場合、normalizeAuthor 内で isAllAscii=true → 大文字化パスに入るため、parseAuthorField で分離された原著者名が正しく正規化される。翻訳者込みの kana が使われるケースは事実上存在しない（dry-run で kana 無視=1件のみ確認）
- 対応: 修正不要。このまま運用

### authorNormalized に「訳」が残る 42 件
- 検出日: 2026-05-02
- Phase: B (PR-B3 本実行後の検証で検出)
- 内容: parseAuthorField で `authors: []` かつ `editors: []` になるパターン（翻訳者のみ、`/編訳`、`/著・訳` 等の複合役割）で、フォールバックにより Work.author 全文が normalizeAuthor に渡され、スラッシュと「訳」が authorNormalized に残る
- 影響: バッチマッチングのバケットキー生成に軽微な影響（同じ翻訳者の別 Work が別バケットになる可能性）。ただし翻訳者のみの Work 同士のマッチングは元々困難なケースであり、実害は限定的
- 対応: PR-B4 以降で parseAuthorField の複合役割対応を追加予定。42 件は手動確認で対応可能な件数
