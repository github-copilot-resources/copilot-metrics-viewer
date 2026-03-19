# GitHub Copilot - Organization で取得可能な個別ユーザーデータ

**作成日:** 2025年12月9日  
**対象:** GitHub Copilot Business（Organization レベル）

---

## 📋 概要

GitHub Copilot を Organization レベルで利用している場合、**個別ユーザー単位で取得できるデータは非常に限定的**です。
組織全体の集計データは豊富に取得できますが、プライバシー保護とAPI設計により、ユーザー別の詳細な活動データは提供されていません。

---

## ✅ 取得可能な個別ユーザーデータ

### 1. シート情報（Seat Assignment）

**エンドポイント:** `GET /orgs/{org}/copilot/billing/seats`

#### 取得できるデータ

| データ項目 | フィールド名 | 説明 | 現在の実装 |
|-----------|-------------|------|-----------|
| GitHubユーザー名 | `assignee.login` | ユーザーのログインID | ✅ 取得済み |
| 表示名 | `assignee.name` | ユーザーの表示名 | ✅ 取得済み |
| シート作成日 | `created_at` | Copilotシートが割り当てられた日時 | ✅ 取得済み |
| 最終利用日時 | `last_activity_at` | 最後にCopilotを使用した日時 | ✅ 取得済み |
| 最終利用エディタ | `last_activity_editor` | 最後に使用したIDE（vscode, jetbrains, vim等） | ✅ 取得済み |
| シート取消予定日 | `pending_cancellation_date` | シート削除がスケジュールされている場合の日付 | ✅ 取得済み |
| アカウントタイプ | `assignee.type` | User, Bot, Organization等 | ✅ 取得済み |

**重要な注意点:**
- `last_activity_at` は**利用日時のみ**で、何をしたかの詳細は含まれない
- `last_activity_editor` は**最後に使用したエディタ名のみ**
- **コード補完回数、Chat利用回数などのメトリクスは含まれない**

**APIレスポンス例:**
```json
{
  "total_seats": 50,
  "seats": [
    {
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-12-08T14:22:00Z",
      "pending_cancellation_date": null,
      "last_activity_at": "2024-12-08T14:22:00Z",
      "last_activity_editor": "vscode",
      "assignee": {
        "login": "yamada",
        "id": 12345678,
        "type": "User",
        "name": "Yamada Taro"
      }
    }
  ]
}
```

---

### 2. ユーザーの Copilot 詳細情報

**エンドポイント:** `GET /orgs/{org}/members/{username}/copilot`

#### 取得できるデータ

| データ項目 | 説明 | 現在の実装 |
|-----------|------|-----------|
| 最終利用日時 | `last_activity_at` | 最後にCopilotを使用した日時 | ✅ 取得済み |
| 最終利用エディタ | `last_activity_editor` | 最後に使用したエディタ | ✅ 取得済み |

**注意:** このエンドポイントは `/copilot/billing/seats` とほぼ同じ情報を返すため、追加情報は限定的です。

---

## ❌ 取得できない個別ユーザーデータ

以下のデータは**Organization レベルでは個別ユーザー単位では取得できません**（組織全体の集計のみ）:

### コード補完関連
- ❌ ユーザー別のコード提案総数（suggestions count）
- ❌ ユーザー別のコード承認総数（acceptances count）
- ❌ ユーザー別の提案行数（lines suggested）
- ❌ ユーザー別の承認行数（lines accepted）
- ❌ ユーザー別の承認率（acceptance rate）
- ❌ ユーザー別の言語別内訳
- ❌ ユーザー別のエディタ別内訳

### Chat 関連
- ❌ ユーザー別の Chat メッセージ数
- ❌ ユーザー別の Chat 挿入イベント数
- ❌ ユーザー別の Chat コピーイベント数
- ❌ ユーザー別の IDE Chat 利用状況
- ❌ ユーザー別の GitHub.com Chat 利用状況

### その他
- ❌ ユーザー別のアクティブ日数
- ❌ ユーザー別のプロンプト内容
- ❌ ユーザー別の生成されたコード内容
- ❌ ユーザー別の PR サマリー作成数
- ❌ ユーザー別の操作リポジトリ情報

---

## 📊 取得可能な集計データ（組織全体・日別）

**エンドポイント:** `GET /orgs/{org}/copilot/metrics`

### 日別で取得できる組織全体の統計

| カテゴリ | データ項目 | 粒度 | 現在の実装 |
|---------|-----------|------|-----------|
| **基本メトリクス** |
| | アクティブユーザー数 | 日別・組織全体 | ✅ 取得済み |
| | エンゲージユーザー数 | 日別・組織全体 | ✅ 取得済み |
| **コード補完** |
| | コード補完利用者数 | 日別・組織全体 | ✅ 取得済み |
| | コード提案総数 | 日別・組織全体 | ✅ 取得済み |
| | コード承認総数 | 日別・組織全体 | ✅ 取得済み |
| | 提案行数 | 日別・組織全体 | ✅ 取得済み |
| | 承認行数 | 日別・組織全体 | ✅ 取得済み |
| | 言語別内訳 | 日別・組織全体 | ❌ 未実装 |
| | エディタ別内訳 | 日別・組織全体 | ❌ 未実装 |
| | モデル別内訳 | 日別・組織全体 | ❌ 未実装 |
| **IDE Chat** |
| | Chat 利用者数 | 日別・組織全体 | ✅ 取得済み |
| | Chat メッセージ総数 | 日別・組織全体 | ✅ 取得済み |
| | Chat 挿入イベント数 | 日別・組織全体 | ✅ 取得済み |
| | Chat コピーイベント数 | 日別・組織全体 | ❌ 未実装 |
| | エディタ別内訳 | 日別・組織全体 | ❌ 未実装 |
| **GitHub.com Chat** |
| | Chat 利用者数 | 日別・組織全体 | ❌ 未実装 |
| | Chat 総数 | 日別・組織全体 | ❌ 未実装 |
| **Pull Request** |
| | PR 機能利用者数 | 日別・組織全体 | ❌ 未実装 |
| | PR サマリー作成数 | 日別・組織全体 | ❌ 未実装 |

**重要:** これらは全て**組織全体の合計値**であり、個別ユーザーの内訳は含まれません。

---

## 🔍 なぜ個別ユーザーデータが取得できないのか？

### 1. プライバシー保護
- ユーザーが書いたコード内容やプロンプト内容は機密情報
- 詳細な活動ログは個人のパフォーマンス評価に悪用される可能性

### 2. GitHub API の設計思想
- 組織レベルの管理者には「全体の傾向」を提供
- 個人の詳細な活動トラッキングは意図的に制限

### 3. 5人未満のチームはデータ非開示
- チーム別メトリクスも5人以上のライセンス保有者が必要
- 少人数グループでの個人特定を防ぐため

---

## 💡 現在のスクリプトで実装されているユーザー別データ

### Sheet 1: メインレポート（ユーザー別）

| 列番号 | 項目名 | データソース | 取得可能 |
|-------|--------|------------|---------|
| 1 | 氏名 | user.csv | ✅ ローカルデータ |
| 2 | GitHubユーザー名 | user.csv | ✅ ローカルデータ |
| 3 | pmed-inc参加 | user.csv | ✅ ローカルデータ |
| 4 | Copilot有効/無効 | user.csv | ✅ ローカルデータ |
| 5 | シート割り当て | `/orgs/{org}/copilot/billing/seats` | ✅ API |
| 6 | 最終利用日時 | `/orgs/{org}/copilot/billing/seats` | ✅ API |
| 7 | 最終利用エディタ | `/orgs/{org}/members/{user}/copilot` | ✅ API |
| 8 | シート作成日 | `/orgs/{org}/copilot/billing/seats` | ✅ API |
| 9 | シート取消予定日 | `/orgs/{org}/copilot/billing/seats` | ✅ API |
| 10 | プロンプト数 | ❌ 存在しないAPI | ❌ 常に 0 |
| 11 | コード生成数 | ❌ 存在しないAPI | ❌ 常に 0 |
| 12 | 受け入れ数 | ❌ 存在しないAPI | ❌ 常に 0 |
| 13 | 追加LoC | ❌ 存在しないAPI | ❌ 常に 0 |
| 14 | アクティブ日数 | ❌ 存在しないAPI | ❌ 常に 0 |
| 15 | 主要IDE | ❌ 存在しないAPI | ❌ 常に空 |

**結論:** 列10-15は**Organization レベルでは取得不可能**なため、削除を推奨。

---

## 🎯 推奨事項

### 1. 不要な列の削除
列10-15（プロンプト数、コード生成数など）は取得できないため、Excelから削除してシンプル化。

### 2. 組織全体の統計を活用
Sheet 2 の日別統計を活用して、組織全体のトレンドを分析。

### 3. ユーザーの利用状況は「最終利用日時」で判断
- 最終利用日時が7日以上前 → 未利用ユーザーとして赤字表示（既に実装済み）
- これが唯一の個別ユーザー活動指標

### 4. 詳細な言語別・エディタ別内訳の追加
組織全体の統計に言語別・エディタ別の内訳を追加（APIレスポンスに含まれているが未実装）。

---

## 📚 参考情報

### 公式ドキュメント
- [Get Copilot metrics for an organization](https://docs.github.com/en/rest/copilot/copilot-metrics#get-copilot-metrics-for-an-organization)
- [List all Copilot seat assignments](https://docs.github.com/en/rest/copilot/copilot-user-management#list-all-copilot-seat-assignments-for-an-organization)

### 必要な権限
- `manage_billing:copilot`（PAT classic）
- `read:org`（PAT classic）
- GitHub Copilot Business (read) または Administration (read)（Fine-grained PAT）

### API制限
- Copilot Metrics API access policy を組織で有効化する必要がある
- Organization owner または親 Enterprise の owner/billing manager のみアクセス可能
- ユーザーの IDE でテレメトリが有効化されている必要がある

---

## ⚠️ 重要な結論

**Organization レベルの GitHub Copilot では:**
- ✅ 個別ユーザーの「最終利用日時」「最終利用エディタ」は取得可能
- ✅ 組織全体の詳細な集計データ（日別、言語別、エディタ別）は取得可能
- ❌ 個別ユーザーの「コード補完回数」「Chat利用回数」などのメトリクスは**一切取得不可**
- ❌ ChatGPT が言及した「ユーザー別サジェスト数」は**誤情報または Enterprise Cloud 限定機能**

このため、現在のスクリプトでユーザー別の詳細メトリクス（列10-15）が全て0になるのは**正常な動作**です。

---

## 🆕 Premium Request Usage API（2025年8月導入・調査中）

### 概要

2025年8月以降、**Premium Request Usage API**が導入され、個別ユーザー単位のPremium Request使用状況を取得できる可能性があります。

### API仕様

**エンドポイント:**
- `GET /organizations/{org}/settings/billing/premium_request/usage`

**重要な機能:**
- ✅ `user`パラメータで**個別ユーザー指定が可能**
- ✅ `model`, `product`でフィルタリング可能
- ✅ 過去24ヶ月分のデータ取得可能

**使用例:**
```bash
# 特定ユーザーのPremium Request使用状況
curl -L \
  -H "Authorization: Bearer TOKEN" \
  https://api.github.com/organizations/ORG/settings/billing/premium_request/usage?user=USERNAME&year=2025&month=12
```

### 現状の制限（2025/12/9 調査）

**テスト結果:**
- ❌ medley-inc組織で404 Not Found
- ❌ Enhanced Billing Platform未移行の可能性
- ❌ Organization単位では利用不可の可能性

**利用可能になる条件（推測）:**
1. Enhanced Billing Platformへの移行
2. Premium Request機能の有効化
3. Enterprise Cloudへのアップグレード（可能性）

### Premium Requestとは

- 高度なCopilot機能使用時にカウントされるリクエスト
- 月次制限（allowance）あり、超過分は追加課金
- 2025年8月1日からデータ収集開始

### 従来のMetrics APIとの違い

| 項目 | Copilot Metrics API | Premium Request API |
|-----|-------------------|-------------------|
| 対象データ | コード補完、Chat、PR | Premium Request使用量 |
| 個別ユーザー | ❌ 取得不可 | ✅ **取得可能**（`user`パラメータ） |
| データ開始 | 機能リリース時 | 2025年8月1日 |
| 現在の状況 | ✅ 利用可能 | ❌ 404エラー（要調査） |

### API利用の制約（公式仕様）

公式ドキュメントによると、Premium Request Usage APIには以下の制約があります:

#### 1. Enhanced Billing Platform 要件

**重要**: Premium Request Usage API は Enhanced Billing Platform **不要**です。

- **Premium Request Usage API** (`/organizations/{org}/settings/billing/premium_request/usage`)
  - ✅ Enhanced Billing Platform 不要
  - ✅ 通常の Organization で利用可能
  
- **Billing Usage Report API** (`/organizations/{org}/settings/billing/usage`)
  - ❌ Enhanced Billing Platform 必須
  - Note: "This endpoint is only available to organizations with access to the enhanced billing platform."

#### 2. データ保持期間

- 過去 **24ヶ月分のみ** アクセス可能
- それ以前のデータは取得不可
- Note: "Only data from the past 24 months is accessible via this endpoint."

#### 3. 権限要件

- **Organization管理者** である必要がある
  - "must be an administrator of an organization within an enterprise or an organization account"
- **Fine-grained token の場合**:
  - "Administration" organization permissions (read) が必要

#### 4. HTTPステータスコード

- 200: 成功
- 400: Bad Request
- **403: Forbidden** (権限不足)
- **404: Resource not found** (組織が見つからない、または機能未有効化)
- 500: Internal Error
- 503: Service unavailable

#### 5. APIバージョンヘッダー

推奨ヘッダー:
```
X-GitHub-Api-Version: 2022-11-28
```

### medley-inc で 404 エラーが発生する原因

公式仕様との照合により、以下の原因が考えられます:

1. **Premium Request 機能が未有効化**
   - 2025年8月導入の新機能のため、段階的展開中の可能性
   - 組織のプランで Premium Request が有効になっていない
   - GitHub Copilot プランに Premium Request が含まれていない

2. **権限不足** (ただし403ではなく404)
   - 使用しているトークンに "Administration" 権限がない可能性
   - 組織管理者でない場合

### 今後の推奨アクション

1. **トークン権限の確認**
   ```powershell
   # 現在のトークンの権限を確認
   curl -H "Authorization: Bearer $env:GITHUB_TOKEN" https://api.github.com/user
   ```

2. **Organization プランの確認**
   - GitHub Web UI → Settings → Billing and plans
   - Premium Request 機能が有効か確認
   - GitHub Copilot プランの詳細を確認

3. **定期的な再テスト**
   - 月1回、test_premium_request_api.py を実行
   - 404エラーが解消されたか確認

4. **GitHub サポートへの問い合わせ**
   - medley-inc 組織で Premium Request Usage API が利用可能か確認
   - Premium Request 機能の有効化方法を確認

5. **代替手段の検討**
   - GitHub Web UI の Premium Request Analytics を使用
   - 手動でのデータエクスポート

### 参考情報

- [REST API - Billing usage](https://docs.github.com/en/rest/billing/usage)
- [Premium リクエストを監視する](https://docs.github.com/ja/copilot/how-tos/manage-and-track-spending/monitor-premium-requests)
- テストスクリプト: `test_premium_request_api.py`
