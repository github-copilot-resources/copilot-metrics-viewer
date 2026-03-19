# GitHub Copilot - Enterprise で取得可能な個別ユーザーデータ

**作成日:** 2025年12月9日  
**対象:** GitHub Copilot Enterprise（Enterprise レベル）

---

## 📋 概要

GitHub Copilot を **Enterprise レベル**で利用している場合、Organization レベルと比較して追加のメトリクスやエンドポイントが利用可能になります。
ただし、**個別ユーザーの詳細な活動データは Enterprise でも非常に制限的**です。

---

## ✅ 取得可能な個別ユーザーデータ

### 1. シート情報（Seat Assignment）- Organization と同等

**エンドポイント:** 
- `GET /enterprises/{enterprise}/copilot/billing/seats`（Enterprise全体）
- `GET /orgs/{org}/copilot/billing/seats`（Organization単位）

#### 取得できるデータ

| データ項目 | フィールド名 | 説明 | Organization との違い |
|-----------|-------------|------|---------------------|
| GitHubユーザー名 | `assignee.login` | ユーザーのログインID | 同じ |
| 表示名 | `assignee.name` | ユーザーの表示名 | 同じ |
| シート作成日 | `created_at` | Copilotシートが割り当てられた日時 | 同じ |
| 最終利用日時 | `last_activity_at` | 最後にCopilotを使用した日時 | 同じ |
| 最終利用エディタ | `last_activity_editor` | 最後に使用したIDE | 同じ |
| 最終認証日時 | `last_authenticated_at` | 最後にCopilotにログインした日時 | 同じ |
| シート取消予定日 | `pending_cancellation_date` | シート削除予定日 | 同じ |
| プランタイプ | `plan_type` | business または enterprise | 同じ |

**重要:** これらは Organization レベルと**全く同じ**情報です。

---

### 2. ユーザー別の Copilot 詳細情報 - Organization と同等

**エンドポイント:** `GET /orgs/{org}/members/{username}/copilot`

Enterprise レベルでも、このエンドポイントから取得できる情報は Organization と同じで、追加データはありません。

---

## 🔍 Enterprise 限定の可能性がある機能（公式ドキュメント未確認）

### Usage Metrics API（NDJSON形式）- 存在が不明確

**想定エンドポイント（未確認）:** 
- `GET /enterprises/{enterprise}/copilot/metrics/reports/users`
- `GET /orgs/{org}/copilot/metrics/reports/users`

#### 取得できる可能性があるデータ（ChatGPT情報、公式未確認）

| データ項目 | 説明 | 確認状況 |
|-----------|------|---------|
| ユーザー別プロンプト数 | `user_initiated_interaction_count` の合計 | ❓ 公式ドキュメント未記載 |
| ユーザー別コード生成数 | `code_generation_activity_count` の合計 | ❓ 公式ドキュメント未記載 |
| ユーザー別受け入れ数 | `code_acceptance_activity_count` の合計 | ❓ 公式ドキュメント未記載 |
| ユーザー別追加LoC | `loc_added_sum` の合計 | ❓ 公式ドキュメント未記載 |
| ユーザー別提案LoC | `loc_suggested_to_add_sum` の合計 | ❓ 公式ドキュメント未記載 |
| ユーザー別アクティブ日数 | アクティブな日数のカウント | ❓ 公式ドキュメント未記載 |
| ユーザー別IDE利用状況 | IDE別の内訳 | ❓ 公式ドキュメント未記載 |
| ユーザー別言語利用状況 | 言語別の内訳 | ❓ 公式ドキュメント未記載 |

**注意事項:**
- ✅ 現在のスクリプトで実装済み（690-813行）
- ❌ 実行すると **404 Not Found** エラー
- ❓ GitHub公式ドキュメントに記載なし
- ❓ Enterprise Cloud 限定機能の可能性
- ❓ ベータ版または限定プレビュー機能の可能性
- ❓ 廃止された機能の可能性

**結論:** このAPIが実際に利用可能かは不明。公式ドキュメントに記載がないため、**現時点では利用不可と判断**すべき。

---

## ✅ Enterprise で確実に取得可能な集計データ

### 1. Enterprise 全体のメトリクス

**エンドポイント:** `GET /enterprises/{enterprise}/copilot/metrics`

Organization の `/orgs/{org}/copilot/metrics` と同じ構造で、Enterprise 全体の集計データを取得。

| データ項目 | 粒度 | 個別ユーザー内訳 |
|-----------|------|----------------|
| アクティブユーザー数 | 日別・Enterprise全体 | ❌ なし |
| エンゲージユーザー数 | 日別・Enterprise全体 | ❌ なし |
| コード提案総数 | 日別・Enterprise全体 | ❌ なし |
| コード承認総数 | 日別・Enterprise全体 | ❌ なし |
| 提案行数 | 日別・Enterprise全体 | ❌ なし |
| 承認行数 | 日別・Enterprise全体 | ❌ なし |
| IDE Chat利用状況 | 日別・Enterprise全体 | ❌ なし |
| GitHub.com Chat利用状況 | 日別・Enterprise全体 | ❌ なし |
| PR機能利用状況 | 日別・Enterprise全体 | ❌ なし |
| 言語別内訳 | 日別・Enterprise全体 | ❌ なし |
| エディタ別内訳 | 日別・Enterprise全体 | ❌ なし |
| モデル別内訳 | 日別・Enterprise全体 | ❌ なし |

**重要:** これらは全て**Enterprise全体の合計値**で、個別ユーザーの内訳は**一切含まれません**。

---

### 2. Team 別のメトリクス（5人以上必要）

**エンドポイント:** 
- `GET /enterprises/{enterprise}/team/{team_slug}/copilot/metrics`
- `GET /orgs/{org}/team/{team_slug}/copilot/metrics`

チーム単位の集計データを取得可能。ただし：
- チームに **5人以上のアクティブライセンス保有者**が必要
- 5人未満のチームは **プライバシー保護のためデータ非開示**
- 個別ユーザーの内訳は含まれない（チーム全体の合計のみ）

---

## ❌ Enterprise でも取得できない個別ユーザーデータ

以下のデータは **Enterprise レベルでも個別ユーザー単位では取得できません**:

### コード補完関連

- ❌ ユーザー別のコード提案総数（suggestions count）
- ❌ ユーザー別のコード承認総数（acceptances count）
- ❌ ユーザー別の提案行数（lines suggested）
- ❌ ユーザー別の承認行数（lines accepted）
- ❌ ユーザー別の承認率（acceptance rate）
- ❌ ユーザー別の言語別内訳
- ❌ ユーザー別のエディタ別内訳
- ❌ ユーザー別のモデル別内訳

### Chat 関連

- ❌ ユーザー別の IDE Chat メッセージ数
- ❌ ユーザー別の IDE Chat 挿入イベント数
- ❌ ユーザー別の IDE Chat コピーイベント数
- ❌ ユーザー別の GitHub.com Chat 利用状況
- ❌ ユーザー別のモデル別内訳

### Pull Request 関連

- ❌ ユーザー別の PR サマリー作成数
- ❌ ユーザー別のリポジトリ別内訳

### その他

- ❌ ユーザー別のアクティブ日数（日数カウント）
- ❌ ユーザーが入力したプロンプト内容
- ❌ Copilotが生成したコード内容
- ❌ 操作対象のリポジトリ名
- ❌ 操作対象のファイルパス
- ❌ Copilot CLI 利用状況
- ❌ Copilot Code Review 利用状況
- ❌ GitHub Mobile 利用状況

---

## 🆚 Enterprise と Organization の比較

### Enterprise で追加される機能

| 機能 | Organization | Enterprise | 備考 |
|-----|-------------|-----------|------|
| **エンドポイント** |
| Enterprise全体のメトリクス | ❌ | ✅ | `/enterprises/{enterprise}/copilot/metrics` |
| Enterprise全体のシート情報 | ❌ | ✅ | `/enterprises/{enterprise}/copilot/billing/seats` |
| Enterprise配下の全Orgを横断集計 | ❌ | ✅ | 複数組織の統合レポート |
| **集計範囲** |
| 単一組織の統計 | ✅ | ✅ | 同じ |
| 複数組織の統合統計 | ❌ | ✅ | Enterprise のみ |
| **個別ユーザーデータ** |
| 最終利用日時 | ✅ | ✅ | 同じ |
| 最終利用エディタ | ✅ | ✅ | 同じ |
| シート情報 | ✅ | ✅ | 同じ |
| コード補完回数 | ❌ | ❌ | **両方とも取得不可** |
| Chat利用回数 | ❌ | ❌ | **両方とも取得不可** |
| アクティブ日数 | ❌ | ❌ | **両方とも取得不可** |
| **権限管理** |
| Organization owner | ✅ | ✅ | 両方アクセス可 |
| Enterprise owner | - | ✅ | Enterprise のみ |
| Billing manager（Enterprise） | - | ✅ | Enterprise のみ |

**重要な結論:**
- Enterprise で**追加される個別ユーザーデータは存在しない**
- Enterprise の利点は「**複数組織の統合集計**」と「**Enterprise全体の可視化**」
- 個別ユーザーの詳細メトリクスは **Organization と全く同じ制限**

---

## 💡 Enterprise で推奨される活用方法

### 1. 複数組織の統合レポート

Enterprise 配下に複数の Organization がある場合:
- 各 Organization のメトリクスを `/orgs/{org}/copilot/metrics` で取得
- Enterprise 全体のメトリクスを `/enterprises/{enterprise}/copilot/metrics` で取得
- 組織別・部門別の比較分析が可能

### 2. チーム別の詳細分析

- `/orgs/{org}/team/{team_slug}/copilot/metrics` でチーム単位の統計取得
- 5人以上のチームであれば詳細データ取得可能
- 部門別・プロジェクト別の利用状況分析

### 3. Enterprise 全体の傾向把握

- Enterprise レベルの日別統計で全社的なトレンド分析
- 言語別・エディタ別の内訳で技術スタック把握
- モデル別（デフォルト/カスタム）の利用状況分析

---

## 🔍 Usage Metrics API（NDJSON）の調査方法

現在のスクリプトには実装されていますが404エラーになります。以下の方法で確認可能：

### 方法1: 直接APIを叩く

```bash
# Enterprise レベル（存在するか不明）
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/enterprises/YOUR_ENTERPRISE/copilot/metrics/reports/users

# Organization レベル（404エラー確認済み）
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/orgs/YOUR_ORG/copilot/metrics/reports/users
```

### 方法2: GitHub サポートに問い合わせ

- Enterprise Cloud のサポート契約がある場合
- ユーザー別詳細メトリクスの利用可否を確認
- ベータ版機能へのアクセス申請

### 方法3: GitHub プレミアムサポートに確認

- ChatGPT が言及した API が実際に存在するか
- Enterprise Cloud 限定機能なのか
- 限定プレビューへの参加方法

---

## 🆕 Premium Request の監視（個人ユーザー向け機能）

### 概要

2025年8月以降、GitHub Copilot に **Premium Request（プレミアムリクエスト）** という新しい概念が導入されました。
これは**個人ユーザーが自分の使用状況を監視する機能**で、組織やEnterpriseの管理者が取得できる集計メトリクスとは**別の仕組み**です。

### Premium Request とは

- 特定の高度なCopilot機能を使用する際にカウントされるリクエスト
- 月次の制限（allowance）があり、超過分は追加課金の対象
- 2025年8月1日からデータ取得開始
- 2025年11月1日から機能別の詳細データ取得開始

### 個人ユーザーが確認できる内容

| 確認方法 | 確認できる内容 | アクセス方法 |
|---------|--------------|-------------|
| **IDE内表示** | 自分の月次使用状況、上限、リセット日 | VS Code: ステータスバーのCopilotアイコン<br>JetBrains: ステータスバー → View quota usage |
| **GitHub.com設定** | 月次使用量の概要 | Settings > Billing > Metered usage > Copilot |
| **詳細分析** | Premium Request の詳細グラフ・テーブル | Settings > Billing > Premium request analytics |
| **使用レポート** | ダウンロード可能なCSV/JSON形式 | Billing settings からダウンロード |

### 組織・Enterprise 管理者が確認できる内容

公式ドキュメントによれば：
> For Copilot Business or Copilot Enterprise plans, organization admins and billing managers can view usage reports for members.

**組織管理者とBilling managerは「メンバーの使用状況レポート」を確認可能**とされています。

### 重要な注意点

**このPremium Request監視機能は：**
- ✅ 個人ユーザーが**自分の使用状況**を確認する機能
- ✅ 組織管理者が**メンバーのPremium Request使用状況**を確認できる（詳細は要調査）
- ❓ **APIで取得できるかは不明**（Web UIのみの可能性）
- ❓ **既存のMetrics APIとは別の仕組み**の可能性
- ⚠️ 2025年8月以降の新機能（データは8月1日から）

### 既存のCopilot Metrics APIとの違い

| 項目 | Copilot Metrics API | Premium Request 監視 |
|-----|-------------------|-------------------|
| 対象データ | コード補完、Chat、PRサマリーなど | Premium Request使用量 |
| データ開始 | 機能リリース時から | 2025年8月1日から |
| アクセス方法 | REST API | Web UI、IDE内表示、REST API |
| 粒度 | 組織/Enterprise全体の集計 | 個人ユーザー単位 |
| 個別ユーザーデータ | ❌ 取得不可 | ✅ 自分のデータは取得可<br>✅ 組織管理者は`user`パラメータで指定可能 |
| API提供 | ✅ あり | ✅ **あり**（ただし404エラー） |
| エンドポイント | `/orgs/{org}/copilot/metrics` | `/organizations/{org}/settings/billing/premium_request/usage` |
| 必要な権限 | `manage_billing:copilot`<br>`read:org` | `Administration` (read) |
| 利用条件 | Copilot Business/Enterprise | Enhanced Billing Platform移行後？ |

### 🔬 Premium Request Usage API の実装確認（2025/12/9 調査）

**APIエンドポイント発見:**
- `GET /organizations/{org}/settings/billing/premium_request/usage`
- `GET /organizations/{org}/settings/billing/usage/summary`

**重要な機能:**
- ✅ `user`パラメータで個別ユーザーのPremium Request使用状況を取得可能
- ✅ `model`, `product`パラメータでフィルタリング可能
- ✅ 過去24ヶ月分のデータがAPI経由で取得可能

**実装テスト結果（medley-inc組織で実施）:**
```
❌ ステータスコード: 404 Not Found
❌ 一般的なUsage Summary APIも404
✅ APIバージョンヘッダー (X-GitHub-Api-Version: 2022-11-28) 指定済み

公式仕様に基づく制約:
1. Enhanced Billing Platform: Premium Request APIは不要（一般的なUsage APIは必須）
2. データ保持期間: 過去24ヶ月分のみ
3. 権限要件: Organization管理者である必要がある
4. HTTPステータス: 403 (権限不足), 404 (機能未有効化)

考えられる原因:
1. Premium Request機能が組織で未有効化（最も可能性が高い）
2. 2025年8月以降の新機能で段階的展開中
3. GitHub Copilotプランに Premium Request が含まれていない
4. 使用しているトークンに "Administration" 権限がない
```

**APIレスポンス例（公式ドキュメントより）:**
```json
{
  "timePeriod": { "year": 2025, "month": 12 },
  "organization": "GitHub",
  "usageItems": [
    {
      "product": "Copilot",
      "sku": "Copilot Premium Request",
      "model": "GPT-5",
      "unitType": "requests",
      "pricePerUnit": 0.04,
      "grossQuantity": 100,
      "grossAmount": 4,
      "netQuantity": 100,
      "netAmount": 4
    }
  ]
}
```

**結論:**
- ✅ API自体は公式ドキュメントに記載あり
- ✅ 個別ユーザー指定機能あり（`user`パラメータ）
- ✅ Enhanced Billing Platform 不要（重要）
- ❌ 現時点では medley-inc 組織で利用不可
- ❓ Premium Request機能の有効化後に利用可能になる可能性

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

3. **Premium Request機能の有効化確認**
   - Copilot設定でPremium Request機能が有効か確認
   - 2025年8月以降の新機能のため、段階的に展開されている可能性

4. **定期的なAPI再テスト**
   - 月1回程度、404エラーが解消されているか確認
   - テストスクリプト: `test_premium_request_api.py` を使用

5. **GitHub サポートへの問い合わせ**
   - Premium Request Usage APIの利用可否を確認
   - Premium Request 機能の有効化方法を確認

### 参考リンク

- [Premium リクエストを監視する](https://docs.github.com/ja/copilot/how-tos/manage-and-track-spending/monitor-premium-requests)
- [Viewing your usage of metered products and licenses](https://docs.github.com/en/billing/how-tos/products/view-productlicense-use)
- [REST API - Billing usage](https://docs.github.com/en/rest/billing/usage)
- [About the enhanced billing platform](https://docs.github.com/billing/using-the-new-billing-platform)

---

## 📚 必要な権限（Enterprise）

### エンドポイント別の権限要件

| エンドポイント | 必要な権限 | 対象ユーザー |
|--------------|-----------|-------------|
| `/enterprises/{enterprise}/copilot/metrics` | `manage_billing:copilot`<br>`read:enterprise` | Enterprise owner<br>Billing manager |
| `/enterprises/{enterprise}/copilot/billing/seats` | `manage_billing:copilot`<br>`read:enterprise` | Enterprise owner<br>Billing manager |
| `/orgs/{org}/copilot/metrics` | `manage_billing:copilot`<br>`read:org` | Organization owner<br>Enterprise owner<br>Billing manager |
| `/orgs/{org}/copilot/billing/seats` | `manage_billing:copilot`<br>`read:org` | Organization owner<br>Enterprise owner<br>Billing manager |

### PAT（Personal Access Token）のスコープ

**Classic PAT:**
- `manage_billing:copilot`（推奨）
- `read:enterprise`（Enterprise メトリクス用）
- `read:org`（Organization メトリクス用）

**Fine-grained PAT:**
- GitHub Copilot Business (read)
- Administration (read)

---

## ⚠️ 重要な結論

### Enterprise でも個別ユーザーデータは取得できない

1. **シート情報のみ取得可能**
   - 最終利用日時
   - 最終利用エディタ
   - これは Organization と全く同じ

2. **詳細メトリクスは取得不可**
   - コード補完回数
   - Chat 利用回数
   - アクティブ日数
   - これも Organization と全く同じ制限

3. **Enterprise の利点は集計範囲**
   - 複数組織の統合レポート
   - Enterprise 全体の可視化
   - チーム別の詳細分析（5人以上）
   - **個別ユーザーデータの追加はなし**

4. **Usage Metrics API（NDJSON）の存在は不明**
   - 公式ドキュメント未記載
   - 実装すると404エラー
   - Enterprise Cloud 限定の可能性
   - ベータ版または廃止機能の可能性

---

## 🎯 現在のスクリプトへの影響

### Organization 版との違い

**変更不要な点:**
- シート情報取得ロジックは同じ
- ユーザー別データの制限は同じ
- Usage Metrics API は両方とも404

**変更可能な点:**
- Enterprise エンドポイントの追加
  - `/enterprises/{enterprise}/copilot/metrics`
  - `/enterprises/{enterprise}/copilot/billing/seats`
- 複数 Organization の統合レポート機能
- チーム別メトリクス取得機能

**結論:**
- 現在のスクリプトは **Organization 版として完成**
- Enterprise 版を作る場合は **集計範囲の拡張**のみ
- **個別ユーザーデータの追加機能は存在しない**

---

## 📖 参考情報

### 公式ドキュメント

- [Get Copilot metrics for an enterprise](https://docs.github.com/en/rest/copilot/copilot-metrics#get-copilot-metrics-for-an-enterprise)
- [Get Copilot metrics for an organization](https://docs.github.com/en/rest/copilot/copilot-metrics#get-copilot-metrics-for-an-organization)
- [Get Copilot metrics for a team](https://docs.github.com/en/rest/copilot/copilot-metrics#get-copilot-metrics-for-a-team)
- [List all Copilot seat assignments for an enterprise](https://docs.github.com/en/rest/copilot/copilot-user-management)

### 設定要件

- Copilot Metrics API access policy を有効化（Organization または Enterprise レベル）
- ユーザーの IDE でテレメトリ有効化
- Copilot Business または Copilot Enterprise サブスクリプション
- 5人以上のアクティブライセンス（チーム別メトリクス取得時）

---

## 📝 まとめ

| 項目 | Organization | Enterprise | 差分 |
|-----|-------------|-----------|------|
| **個別ユーザーのシート情報** | ✅ | ✅ | なし |
| **個別ユーザーの詳細メトリクス** | ❌ | ❌ | なし |
| **組織全体の集計データ** | ✅ | ✅ | なし |
| **複数組織の統合集計** | ❌ | ✅ | **あり** |
| **Enterprise 全体の可視化** | ❌ | ✅ | **あり** |
| **チーム別メトリクス** | ✅ | ✅ | なし |
| **Usage Metrics API** | ❌ (404) | ❓ (不明) | 要確認 |

**最終結論:**
- **Enterprise でも個別ユーザーの詳細メトリクスは取得できない**
- **Organization と Enterprise の違いは「集計範囲」のみ**
- **ChatGPT が言及した API は公式未確認で利用不可**
