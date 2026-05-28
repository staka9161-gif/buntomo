# DEPLOY TODO - buntomo.bunkare.jp 本番デプロイ前チェックリスト

最終更新: 2026-05-19

---

## 1. Neon DB シンガポールリージョン移行

- [ ] Vercel Marketplace の Neon 連携で新プロジェクトを Singapore リージョンに作成
- [ ] Import Data Assistant で旧 DB (us-east-1) から新 DB にデータ移行
- [ ] データ検証 (Work: 13,998 / Edition: 20,808 / Book: 14,442 / User: 1)
- [ ] ローカル .env の接続URL更新 (`DATABASE_POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED`)
- [ ] Vercel 環境変数の接続URL更新
- [ ] 旧プロジェクトは安定稼働確認(1週間)まで保持、その後削除

**手順メモ**: Neon Console > Projects > Import Data Assistant で旧DBの unpooled 接続文字列を入力。新プロジェクトは Region: Asia Pacific (Singapore), Postgres 17, DB名: neondb で作成。詳細は前回の移行計画を参照。

---

## 2. 漏洩した秘密情報のローテーション

以下の情報が git 履歴またはローカルに平文で存在するため、本番前にすべて再生成が必要。

- [ ] **Neon DB パスワード** (現: npg_EFGLR4M6TtjU)
  - Neon Console > Project > Roles > neondb_owner > Reset Password
  - .env と Vercel 環境変数の両方を更新
- [ ] **Gmail アプリパスワード** (SMTP_PASS)
  - Google アカウント > セキュリティ > アプリパスワード で再生成
  - .env の `SMTP_PASS` と Vercel 環境変数を更新
- [ ] **Google Books API キー**
  - Google Cloud Console > APIs & Services > Credentials で再生成
  - .env の該当キーと Vercel 環境変数を更新
- [ ] **Rakuten API キー**
  - Rakuten Developers で再生成
  - .env の該当キーと Vercel 環境変数を更新
- [ ] **AUTH_SECRET**
  - ローカルと本番で別の値を使用中(正しい運用)
  - 本番は Vercel に保存済み、ローカルは .env に記載
  - 念のため `npx auth secret` で両方再生成を推奨

---

## 3. ~~Google OAuth 同意画面の公開~~ → 廃止済み (2026-05-28)

Google OAuth は廃止。メール+パスワード認証のみに統一。
理由: 一般公開に際し、未確認アプリ警告・検証申請の手間を回避するため。
- [x] login/signup ページから Google ボタン削除
- [x] lib/auth.ts から Google プロバイダー削除
- [x] .env から AUTH_GOOGLE_ID/SECRET 削除
- [ ] Vercel ダッシュボードから AUTH_GOOGLE_ID/SECRET 環境変数を削除(ユーザー作業)

---

## 4. アバター画像の保存方式変更

- [ ] 現状: base64 エンコードで User.image に直接保存(DB 肥大化リスク)
- [ ] 目標: Vercel Blob または同等のオブジェクトストレージに移行
- [ ] 手順:
  1. Vercel Blob をセットアップ (`@vercel/blob` パッケージ)
  2. `app/api/me/profile/avatar/route.ts` を Blob アップロードに変更
  3. User.image に Blob の URL を保存する形式に変更
  4. 既存の base64 データがあれば移行スクリプトで変換
- [ ] 優先度: 中(ユーザー数が少ないうちは問題にならない)

---

## 5. 本番ドメイン・認証設定の確認

- [ ] Vercel の `AUTH_URL` 環境変数が `https://buntomo.bunkare.jp` になっているか確認
  - Vercel Dashboard > Settings > Environment Variables で検索
- [ ] メール認証の verify-email リンクが本番ドメインを指すか確認
  - `app/api/auth/signup/route.ts` 内の認証メールURL生成箇所を確認
  - `AUTH_URL` または `NEXTAUTH_URL` から動的に生成されていればOK
- [ ] パスワードリセットメールのリンクも同様に確認

---

## 6. クリーンアップ(オプション)

- [ ] EmailVerificationToken テーブルの期限切れトークン掃除
  - `prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: new Date() } } })`
  - 定期実行するなら Vercel Cron Job で `/api/cron/cleanup-tokens` を作成
- [ ] PasswordResetToken テーブルも同様に掃除
- [ ] 不要な test ユーザーが再度作られていないか確認
  - `scripts/list-all-users.ts` で定期チェック

---

## 実行順序(推奨)

1. 秘密情報のローテーション (項目2) -- 最優先、漏洩リスク排除
2. Google OAuth 公開 (項目3) -- ユーザー受け入れに必須
3. 本番ドメイン確認 (項目5) -- 認証フローの正常動作に必須
4. Neon DB 移行 (項目1) -- パフォーマンス改善、後からでもOK
5. アバター保存方式 (項目4) -- ユーザー数増加後でもOK
6. クリーンアップ (項目6) -- 任意タイミング
7. ロゴを SVG 化 -- 現在 PNG 4.8MB、next/image で自動最適化されるが SVG にすればさらに軽量・スケーラブル
8. 書影URLの代替ソース検討 -- NDL(403)や楽天(404)由来の画像が壊れるケースあり。OpenBD は生存中だが ISBN によっては 404。代替ソースからの再取得スクリプト開発を検討
