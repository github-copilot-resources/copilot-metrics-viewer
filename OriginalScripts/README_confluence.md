# GitHub Copilot 利用状況レポート生成ツール

## 概要

GitHub Copilot の利用状況を自動的に収集し、Excel レポートとして出力するPythonスクリプトです。

**主な機能：**
- ユーザーごとの最終利用日時・利用エディタを取得
- 1週間以上未利用ユーザーを自動検出（赤字表示）
- チーム単位での絞り込み対応
- Excel形式でのレポート出力
- 高速処理（並列化により約6.5倍高速化）
- APIキャッシュによる呼び出し削減（96%削減）

---

## 導入方法

### 1. 前提条件

- **Python 3.9以上**
- **GitHub Personal Access Token**（`read:org` 権限必須）

### 2. 必要なライブラリのインストール

```powershell
pip install requests openpyxl
```

### 3. 設定ファイル（`.env`）の作成

プロジェクトルートに `.env` ファイルを作成し、以下を記載：

```env
NUXT_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
NUXT_PUBLIC_GITHUB_ORG=medley-inc
TARGET_TEAM_SLUG=mall
```

| 設定項目 | 説明 | 必須 |
|---------|------|------|
| `NUXT_GITHUB_TOKEN` | GitHub Personal Access Token | 必須 |
| `NUXT_PUBLIC_GITHUB_ORG` | 組織名（例: medley-inc） | 必須 |
| `TARGET_TEAM_SLUG` | 対象チーム名（例: mall）<br>※未指定の場合は全ユーザー対象 | 任意 |

### 4. ユーザーリスト（`user.csv`）の準備

以下の形式でCSVファイルを作成（UTF-8 BOM付き推奨）：

```csv
氏名,GitHubユーザー名,pmed-incへの参加,GitHub Copilotの有効/無効
山田 太郎,yamada,2023/04/01,有効
佐藤 花子,hanako,2022/11/01,無効
```

**注意：** ヘッダ名に多少の揺らぎ（「pmed-inc参加」など）があっても自動対応します。

---

## 使い方

### 基本的な実行方法

```powershell
python copilot_last_activity_report.py user.csv
```

または `.env` ファイルを明示的に指定：

```powershell
python copilot_last_activity_report.py user.csv .env
```

### 実行結果

`./data` ディレクトリに以下の形式でExcelファイルが生成されます：

```
./data/copilot_report_20251205095123.xlsx
```

### 実行ログの例

```
2025-12-05 09:51:45 - INFO - チームメンバーを取得中: mall
2025-12-05 09:51:46 - INFO - チームメンバー 52 名を取得しました
2025-12-05 09:51:46 - INFO - Copilot シート情報を取得中: medley-inc
2025-12-05 09:51:48 - INFO - ユーザー情報処理開始: 62 名
2025-12-05 09:51:48 - INFO - 対象ユーザー: 48 名
2025-12-05 09:51:48 - INFO - ユーザー詳細情報を並列取得中: 48 名
2025-12-05 09:51:52 - INFO - 統計: 総ユーザー数=48, 未利用=9, 利用=39
Excel ファイルを出力しました: ./data/copilot_report_20251205095123.xlsx
```

---

## 出力されるExcelレポートの内容

### 1. ヘッダー情報
- 対象チーム名（例: mall）
- データ収集日時（JST）

### 2. メンバー一覧（9項目）

| 項目 | 説明 |
|------|------|
| 氏名 | ユーザーの氏名 |
| GitHubユーザー名 | GitHubアカウント名 |
| pmed-inc参加 | 参加日 |
| Copilot有効/無効 | ライセンス状態 |
| シート割り当て | シートの有無 |
| 最終利用日時 | 最後にCopilotを使った日時（JST） |
| 最終利用エディタ | 使用したエディタ（VS Code、JetBrainsなど） |
| シート作成日 | シートが作成された日時 |
| シート取消予定日 | キャンセル予定日（該当時のみ） |

**注意：** 7日以上未利用のユーザーは**赤字・太字**で強調表示されます。

### 3. 未利用ユーザー一覧

7日以上未利用のユーザーのみを抽出した一覧

### 4. 統計情報

- 7日以上未利用ユーザー数 / 割合（%）
- 7日以内に利用したユーザー数 / 割合（%）
- 総ユーザー数

---

## パフォーマンスとキャッシュ機能

### 並列処理による高速化

- **最大10並列**でユーザー詳細情報を取得
- **処理時間：** 約24秒 → 約3.7秒（約6.5倍高速化）

### キャッシュ機構

このスクリプトは2種類のキャッシュを実装しています：

#### 1. ETagベースのキャッシュ
- **対象：** Copilotシート情報、チームメンバー情報
- **仕組み：** GitHub API の ETag ヘッダーを利用
- **動作：**
  - データ未変更時 → 304 Not Modified（キャッシュ使用）
  - データ変更時 → 200 OK（新データ取得）
- **メリット：** データが変更された瞬間に検知、時間制限なし

#### 2. 時間ベースのキャッシュ
- **対象：** ユーザー詳細情報（エディタ情報）
- **有効期限：** 60分
- **動作：** 60分以内の再実行時はキャッシュから取得（API呼び出しなし）

### API呼び出し削減効果（48ユーザー、チーム指定の場合）

| 実行タイミング | API呼び出し回数 | 削減率 |
|--------------|----------------|--------|
| 初回実行 | 約50回 | - |
| 60分以内の再実行 | 約2回 | **96%削減** |

### キャッシュファイルの管理

- **保存場所：** `./cache` ディレクトリ（自動作成）
- **形式：** JSON
- **クリア方法：** `./cache` ディレクトリを削除

```powershell
# キャッシュをクリアする場合
Remove-Item -Recurse -Force ./cache
```

---

## カスタマイズ設定

スクリプト内の定数を変更することで、動作をカスタマイズできます：

```python
INACTIVE_DAYS = 7  # 未利用と判定する日数（デフォルト: 7日）
MAX_WORKERS = 10   # 並列処理の最大スレッド数（デフォルト: 10）
JST_OFFSET = 9     # タイムゾーンオフセット（JST: UTC+9）
CACHE_EXPIRY_MINUTES_USER_DETAILS = 60  # ユーザー詳細キャッシュ有効期限（分）
```

---

## 注意事項

### GitHub APIのレート制限

- **認証済みリクエスト：** 5,000リクエスト/時間
- キャッシュ機構により、通常の使用では制限に達することはありません

### Excelファイルの上書き

- Excelファイルを開いたまま実行すると保存エラーになります
- エラーが出た場合は、Excelを閉じてから再実行してください

### CSVファイルのエンコーディング

- **推奨：** UTF-8 BOM付き
- Excelで保存する場合は「CSV UTF-8（コンマ区切り）」を選択

---

## トラブルシューティング

### Q1. `GitHub Token が見つかりません` というエラーが出る

**A:** `.env` ファイルの設定を確認してください。

```env
NUXT_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
```

### Q2. `指定されたチームが見つかりません` というエラーが出る

**A:** `TARGET_TEAM_SLUG` の値が正しいか確認してください。チーム名は組織の Settings > Teams で確認できます。

### Q3. 処理が遅い

**A:** 以下を確認してください：
- キャッシュが有効になっているか（`./cache` ディレクトリの存在）
- ネットワーク接続が安定しているか

### Q4. 一部のユーザー情報が取得できない

**A:** 以下の可能性があります：
- ユーザーがCopilotシートを持っていない
- ユーザーが組織から削除されている
- GitHubユーザー名が間違っている

---

## サマリーレポート版

より軽量な `copilot_summary_append.py` もあります：

**特徴：**
- Excelに1行ずつ統計情報を追記
- ユーザー詳細情報を取得しない（高速）
- API呼び出し数が少ない（2回のみ）

**使い方：**
```powershell
python copilot_summary_append.py user.csv .env copilot_summary_log.xlsx
```

---

## 関連リンク

- [GitHub API ドキュメント](https://docs.github.com/en/rest)
- [Personal Access Token の作成方法](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

---

## 更新履歴

### 2025-12-05
- マジックナンバーの定数化
- ログ機能追加
- 並列処理実装（約6.5倍高速化）
- ETagベースのキャッシュ実装
- ユーザー詳細情報への時間ベースキャッシュ追加（API呼び出し96%削減）
- タイムゾーン処理をJSTに統一
- エラーハンドリング強化

---

## お問い合わせ

不明点があれば、開発チームまでご連絡ください。

---

## スクリプト全文

### copilot_last_activity_report.py

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-

# ============================================================
# GitHub Copilot 利用状況レポート生成スクリプト
# （Copilot Last Activity Report）
#
# 【このスクリプトが行うこと】
# 1. user.csv を読み込み（各ユーザーの氏名・GitHubアカウント・参加区分など）
# 2. GitHub API を使い、Copilot の利用状況（最終利用日時・利用エディタなど）を取得
# 3. チーム指定（TARGET_TEAM_SLUG）されていれば、そのチームのメンバーだけを対象に抽出
# 4. Excel 形式でレポートを出力（./data ディレクトリに保存）
# 5. 以下を自動生成する：
#      - 対象チーム名とデータ収集日時（ヘッダ行に表示）
#      - メンバー一覧（最終利用7日以上未利用者＝赤字で強調）
#      - 未利用メンバー一覧（9項目フル）
#      - 利用/未利用ユーザー数と利用率
#
# ============================================================
# 【事前準備】
# ------------------------------------------------------------
# 1. 必要ライブラリのインストール
#       pip install requests openpyxl
#
# 2. GitHub Personal Access Token を準備（read:org 権限推奨）
#    .envファイルに以下のように記載：
#
#        NUXT_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
#        NUXT_PUBLIC_GITHUB_ORG=medley-inc
#        TARGET_TEAM_SLUG=mall        ← 任意。指定しなければ全ユーザー対象
#
# 3. user.csv の形式例（UTF-8 BOM付推奨）：
#
#        氏名,GitHubユーザー名,pmed-incへの参加,GitHub Copilotの有効/無効
#        山田 太郎,yamada,2023/04/01,有効
#        佐藤 花子,hanako,2022/11/01,無効
#
#    ※ヘッダ名称に多少揺らぎがあってもスクリプト側で自動対応します。
#
# ============================================================
# 【使い方】
# ------------------------------------------------------------
#   python copilot_last_activity_report.py user.csv
#   python copilot_last_activity_report.py user.csv .env
#
# 例：
#   python copilot_last_activity_report.py ./user.csv
#
# 実行すると、以下のように Excel ファイルが生成されます：
#
#   ./data/copilot_report_20251205113055.xlsx
#
# ============================================================
# 【出力される Excel レポートの内容】
#
#   1行目：対象チーム名（例：mall）とデータ収集日時
#   空行
#   メンバー一覧（9項目）
#     ・氏名
#     ・GitHubユーザー名
#     ・pmed-inc参加
#     ・Copilot有効/無効
#     ・シート割り当て
#     ・最終利用日時
#     ・最終利用エディタ
#     ・シート作成日
#     ・シート取消予定日
#
#   その後：
#     【1週間以上未利用ユーザー（赤字対象）一覧】
#     ・未利用ユーザー一覧（同じ9項目）
#
#     利用/未利用ユーザー数・割合（%）
#
# ============================================================
# 【注意事項】
# ------------------------------------------------------------
# - GitHub API 呼び出しが多いので、レートリミットに注意
# - Excel を開いた状態では保存に失敗するので閉じて再実行
# - user.csv のヘッダ揺らぎ（「pmed-inc参加」「pmed-incへの参加」など）は
#   自動的に正規化して解決します
#
# ============================================================
# 【キャッシュとETagについて】
# ------------------------------------------------------------
# このスクリプトは GitHub API の呼び出し回数を削減するため、
# キャッシュ機構を実装しています。
#
# ■ キャッシュの種類と動作
#
# 1. ETagベースのキャッシュ（Copilotシート情報、チームメンバー）
#    - GitHub API の ETag ヘッダーを利用した変更検知
#    - If-None-Match ヘッダーで前回の ETag を送信
#    - データ未変更時: 304 Not Modified レスポンス（軽量、キャッシュ使用）
#    - データ変更時: 200 OK レスポンス（新データ取得、キャッシュ更新）
#    - メリット: データが変更された瞬間に検知、時間制限なし
#
# 2. 時間ベースのキャッシュ（ユーザー詳細情報）
#    - 有効期限: 60分（CACHE_EXPIRY_MINUTES_USER_DETAILS で設定可能）
#    - 60分以内の再実行時はキャッシュから読み込み（API呼び出しなし）
#    - 60分経過後は API から再取得
#    - メリット: エディタ情報も含めて大幅にAPI呼び出しを削減
#
# ■ キャッシュファイルの保存場所
#    ./cache ディレクトリ（自動作成）
#    - JSON形式で保存
#    - ファイル名: MD5ハッシュ（org名、チーム名、ユーザー名などから生成）
#
# ■ API呼び出し削減効果（48ユーザー、チーム指定の場合）
#    初回実行: 約50回のAPI呼び出し
#    60分以内の再実行: 約2回（シート + チーム、両方とも304レスポンス）
#    削減率: 96%
#
# ■ キャッシュの無効化
#    ./cache ディレクトリを削除すると、全てのキャッシュがクリアされます
#
# ============================================================
# 【ChangeLog】
# 2025-12-05: コード品質改善とパフォーマンス最適化
#   - マジックナンバーの定数化 (INACTIVE_DAYS=7, MAX_WORKERS=10)
#   - ログ機能追加 (logging モジュール、処理進捗の可視化)
#   - ページネーション処理の共通化 (paginate_github_api 関数)
#   - エラーハンドリング強化 (timeout=30秒、具体的な例外型、lazy formatting)
#   - ユーザー詳細取得の並列化 (ThreadPoolExecutor、最大10並列)
#     * 48ユーザーの処理が約24秒 → 約3.7秒に短縮（約6.5倍高速化）
#   - タイムゾーン処理の統一 (UTC基準)
#   - CSV ヘッダ検出の改善 (完全一致を優先)
#   - ETagベースのキャッシュ機構実装
#     * GitHub API の ETag を利用した変更検知
#     * 304 Not Modified レスポンスによる API 呼び出し削減
#     * ./cache ディレクトリにキャッシュデータを保存
#     * データ変更時のみ新規取得、未変更時はキャッシュ使用
# ============================================================

import csv
import hashlib
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed  # type: ignore
from typing import Dict, Any, List, Optional, Set

import requests
from openpyxl import Workbook
from openpyxl.styles import Font
from datetime import datetime, timezone

GITHUB_API_BASE = "https://api.github.com"
INACTIVE_DAYS = 7  # 未利用と判定する日数
MAX_WORKERS = 10  # 並列API呼び出しの最大スレッド数
JST_OFFSET = 9  # JSTのオフセット（UTC+9）

# キャッシュ設定
CACHE_DIR = "./cache"
CACHE_EXPIRY_MINUTES = 10  # キャッシュ有効期限（分）- ETag対応 API用（参考情報）
CACHE_EXPIRY_MINUTES_USER_DETAILS = 60  # ユーザー詳細情報のキャッシュ有効期限（分）

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)


# -------------------------
# キャッシュユーティリティ
# -------------------------
def get_cache_key(prefix: str, *args: Any) -> str:
    """キャッシュキーを生成"""
    key_str = f"{prefix}_{'_'.join(str(arg) for arg in args)}"
    return hashlib.md5(key_str.encode()).hexdigest()


def load_cache(cache_key: str) -> tuple[Optional[Any], Optional[str]]:
    """キャッシュからデータとETagを読み込む"""
    if not os.path.exists(CACHE_DIR):
        return None, None
    
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.json")
    if not os.path.exists(cache_file):
        return None, None
    
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
        
        cached_at = cache_data.get('cached_at', 0)
        etag = cache_data.get('etag')
        data = cache_data.get('data')
        
        now = time.time()
        age_minutes = (now - cached_at) / 60
        
        logging.info("キャッシュが存在: %s (取得から%.1f分経過, ETag: %s)", 
                     cache_key, age_minutes, etag or "N/A")
        
        return data, etag
    
    except (json.JSONDecodeError, IOError) as e:
        logging.warning("キャッシュ読み込みエラー: %s - %s", cache_key, e)
        return None, None


def load_cache_with_expiry(cache_key: str, expiry_minutes: int) -> Optional[Any]:
    """時間ベースのキャッシュ読み込み（有効期限チェック付き）"""
    if not os.path.exists(CACHE_DIR):
        return None
    
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.json")
    if not os.path.exists(cache_file):
        return None
    
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
        
        cached_at = cache_data.get('cached_at', 0)
        now = time.time()
        age_minutes = (now - cached_at) / 60
        
        # 有効期限チェック
        if age_minutes > expiry_minutes:
            logging.debug("キャッシュが期限切れ: %s (%.1f分経過)", cache_key, age_minutes)
            return None
        
        logging.info("キャッシュからデータを読み込み: %s (%.1f分経過)", cache_key, age_minutes)
        return cache_data.get('data')
    
    except (json.JSONDecodeError, IOError) as e:
        logging.warning("キャッシュ読み込みエラー: %s - %s", cache_key, e)
        return None


def save_cache(cache_key: str, data: Any, etag: Optional[str] = None) -> None:
    """データとETagをキャッシュに保存"""
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.json")
    cache_data = {
        'cached_at': time.time(),
        'etag': etag,
        'data': data
    }
    
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
        logging.debug("キャッシュに保存: %s (ETag: %s)", cache_key, etag or "N/A")
    except IOError as e:
        logging.warning("キャッシュ保存エラー: %s - %s", cache_key, e)


# -------------------------
# 日付パース & フォーマット
# -------------------------
def parse_iso_datetime(dt_str: str) -> Optional[datetime]:
    """GitHub API から返る ISO8601 文字列を datetime に変換する"""
    if not dt_str:
        return None
    try:
        # "Z" を "+00:00" に変換してからパース
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def format_datetime(dt_str: str) -> str:
    """ISO8601 文字列を 'yyyy/MM/dd HH:MM' 形式 (JST) に変換する"""
    dt = parse_iso_datetime(dt_str)
    if not dt:
        return ""
    # UTCからJSTに変換
    from datetime import timedelta
    jst = timezone(timedelta(hours=JST_OFFSET))
    dt_jst = dt.astimezone(jst)
    return dt_jst.strftime("%Y/%m/%d %H:%M")


# -------------------------
# 設定ファイル(.env)読み取り
# -------------------------
def load_config_from_env_file(path: str = ".env") -> (str, str, Optional[str]):
    token = None
    org = None
    team_slug: Optional[str] = None

    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip()
                if k in ("NUXT_GITHUB_TOKEN", "GITHUB_TOKEN"):
                    token = v
                elif k in ("NUXT_PUBLIC_GITHUB_ORG", "GITHUB_ORG"):
                    org = v
                elif k == "TARGET_TEAM_SLUG":
                    team_slug = v

    token = os.environ.get("NUXT_GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN") or token
    org = os.environ.get("NUXT_PUBLIC_GITHUB_ORG") or os.environ.get("GITHUB_ORG") or org
    team_slug = os.environ.get("TARGET_TEAM_SLUG") or team_slug

    if not token:
        print("GitHub Token が見つかりません。.env または環境変数を確認してください。", file=sys.stderr)
        sys.exit(1)
    if not org:
        print("GitHub Organization が見つかりません。.env または環境変数を確認してください。", file=sys.stderr)
        sys.exit(1)

    return token, org, team_slug


# -------------------------
# GitHub API 共通ヘッダ
# -------------------------
def github_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


# -------------------------
# GitHub API ページネーション共通処理
# -------------------------
def paginate_github_api(url: str, token: str, data_key: Optional[str] = None, etag: Optional[str] = None) -> tuple[List[Dict[str, Any]], Optional[str]]:
    """
    GitHub API のページネーションを処理して全データを取得 (ETag対応)
    
    Args:
        url: API エンドポイント URL
        token: GitHub トークン
        data_key: レスポンスからデータを取得するキー（Noneの場合はレスポンス自体がリスト）
        etag: 前回取得時のETag
    
    Returns:
        (データリスト, 新しいETag)
    """
    results: List[Dict[str, Any]] = []
    params: Optional[Dict[str, Any]] = {"per_page": 100}
    new_etag: Optional[str] = None
    
    while url:
        try:
            headers = github_headers(token)
            # ETagがあればIf-None-Matchヘッダを追加
            if etag and not results:  # 最初のリクエストのみ
                headers['If-None-Match'] = etag
            
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            
            # 304 Not Modified - データ未変更
            if resp.status_code == 304:
                logging.info("データ未変更 (304 Not Modified) - キャッシュを使用")
                return [], etag  # 空リストと旧ETagを返す（呼び出し側でキャッシュ使用）
            
            resp.raise_for_status()
            
            # 新しいETagを取得（最初のレスポンスのみ）
            if not new_etag:
                new_etag = resp.headers.get('ETag')
            
            data = resp.json()
            
            if data_key:
                results.extend(data.get(data_key, []))
            else:
                if isinstance(data, list):
                    results.extend(data)
                else:
                    results.append(data)
            
            # 次ページのURLを取得
            link = resp.headers.get("Link", "")
            next_url = None
            if link:
                for part in link.split(","):
                    part = part.strip()
                    if 'rel="next"' in part:
                        start = part.find("<") + 1
                        end = part.find(">")
                        next_url = part[start:end]
                        break
            
            url = next_url
            params = None
            
        except requests.exceptions.RequestException as e:
            logging.error("API リクエストエラー: %s - %s", url, e)
            break
    
    return results, new_etag


# -------------------------
# Copilot シート情報取得
# -------------------------
def fetch_all_seats(org: str, token: str) -> List[Dict[str, Any]]:
    """Copilot シート情報を全て取得（ETagキャッシュ対応）"""
    cache_key = get_cache_key("seats", org)
    
    # キャッシュチェック
    cached_data, cached_etag = load_cache(cache_key)
    
    # API呼び出し
    url = f"{GITHUB_API_BASE}/orgs/{org}/copilot/billing/seats"
    logging.info("Copilot シート情報を取得中: %s (ETag付きリクエスト)", org)
    
    seats, new_etag = paginate_github_api(url, token, data_key="seats", etag=cached_etag)
    
    # 304の場合はキャッシュを使用
    if not seats and cached_data is not None:
        logging.info("キャッシュデータを使用: %d件", len(cached_data))
        return cached_data
    
    # 新しいデータをキャッシュに保存
    if seats:
        logging.info("新しいデータを取得: %d件", len(seats))
        save_cache(cache_key, seats, new_etag)
        return seats
    
    # キャッシュも新データもない場合
    return []


# -------------------------
# チームメンバー一覧取得
# -------------------------
def fetch_team_members(org: str, token: str, team_slug: str) -> Set[str]:
    """チームメンバー一覧を取得（ETagキャッシュ対応）"""
    cache_key = get_cache_key("team_members", org, team_slug)
    
    # キャッシュチェック
    cached_data, cached_etag = load_cache(cache_key)
    
    url = f"{GITHUB_API_BASE}/orgs/{org}/teams/{team_slug}/members"
    logging.info("チームメンバーを取得中: %s (ETag付きリクエスト)", team_slug)
    
    try:
        # 404チェックのため最初のリクエストを個別に実行
        headers = github_headers(token)
        if cached_etag:
            headers['If-None-Match'] = cached_etag
        
        resp = requests.get(url, headers=headers, params={"per_page": 100}, timeout=30)
        
        if resp.status_code == 404:
            logging.error("指定されたチームが見つかりません: org=%s, team_slug=%s", org, team_slug)
            return set()
        
        # 304 Not Modified - キャッシュ使用
        if resp.status_code == 304:
            logging.info("データ未変更 (304) - キャッシュを使用: %d名", len(cached_data) if cached_data else 0)
            return set(cached_data) if cached_data else set()
        
        resp.raise_for_status()
        
        # ページネーション処理
        data, new_etag = paginate_github_api(url, token, etag=cached_etag)
        members = {m.get("login") for m in data if m.get("login")}
        logging.info("チームメンバー %d 名を取得しました", len(members))
        
        # キャッシュ保存（setはJSON化できないのlistに変換）
        save_cache(cache_key, list(members), new_etag)
        
        return members
        
    except requests.exceptions.RequestException as e:
        logging.error("チームメンバー取得エラー: %s", e)
        return set()


# -------------------------
# 個別ユーザー Copilot 詳細
# -------------------------
def fetch_user_seat_details(org: str, token: str, username: str) -> Optional[Dict[str, Any]]:
    """個別ユーザーの Copilot 詳細情報を取得（キャッシュ対応）"""
    cache_key = get_cache_key("user_details", org, username)
    
    # キャッシュチェック
    cached_data = load_cache_with_expiry(cache_key, CACHE_EXPIRY_MINUTES_USER_DETAILS)
    if cached_data is not None:
        return cached_data
    
    url = f"{GITHUB_API_BASE}/orgs/{org}/members/{username}/copilot"
    try:
        resp = requests.get(url, headers=github_headers(token), timeout=30)
        
        if resp.status_code in (404, 422):
            return None
        
        resp.raise_for_status()
        details = resp.json()
        
        # キャッシュ保存
        save_cache(cache_key, details)
        
        return details
        
    except requests.exceptions.RequestException as e:
        logging.warning("ユーザー %s の詳細取得エラー: %s", username, e)
        return None


# -------------------------
# CSV 読み込み（ヘッダ正規化 & N/A 補完）
# -------------------------
def read_user_csv(path: str) -> List[Dict[str, str]]:
    """
    ユーザー一覧 CSV を読み込む。
    - ヘッダ名の前後の空白、全角空白、複数空白を正規化
    - 各値も同様に正規化
    - 空値は "N/A" を入れる
    """
    import re

    def normalize(s: Any) -> Any:
        if not isinstance(s, str):
            return s
        s = s.replace("\u3000", " ")
        s = re.sub(r"\s+", " ", s)
        return s.strip()

    rows: List[Dict[str, str]] = []

    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        if reader.fieldnames:
            reader.fieldnames = [normalize(h) for h in reader.fieldnames]

        for raw_row in reader:
            normalized_row: Dict[str, str] = {}
            for k, v in raw_row.items():
                key = normalize(k)
                val = normalize(v)
                if val in ("", None):
                    val = "N/A"
                normalized_row[key] = val
            rows.append(normalized_row)

    return rows


# -------------------------
# メイン処理
# -------------------------
def main() -> None:
    if len(sys.argv) < 2:
        print("使い方: python copilot_last_activity_report.py user.csv [.env]", file=sys.stderr)
        sys.exit(1)

    user_csv_path = sys.argv[1]
    config_path = sys.argv[2] if len(sys.argv) >= 3 else ".env"

    token, org, team_slug = load_config_from_env_file(config_path)

    team_members: Optional[Set[str]] = None
    if team_slug:
        team_members = fetch_team_members(org, token, team_slug)
        print(f"TARGET_TEAM_SLUG={team_slug} が指定されました。チームメンバー {len(team_members)} 名を対象とします。")

    seats = fetch_all_seats(org, token)
    seat_by_login: Dict[str, Dict[str, Any]] = {
        seat.get("assignee", {}).get("login"): seat
        for seat in seats
        if seat.get("assignee", {}).get("login")
    }

    users = read_user_csv(user_csv_path)
    if not users:
        print("user.csv にデータがありません。", file=sys.stderr)
        sys.exit(1)

    # === ここで実際のヘッダ名から列名を推定する ===
    sample_keys = list(users[0].keys())

    def find_col(patterns: List[str], default: str) -> str:
        """CSVヘッダから列名を検出（完全一致を優先）"""
        # まず完全一致を試す
        if default in sample_keys:
            return default
        # 次にパターンマッチ
        for col in sample_keys:
            if all(p in col for p in patterns):
                return col
        return default

    # あなたの user.csv だと:
    #  - 「pmed-incへの参加」
    #  - 「GitHub Copilotの有効/無効」
    joined_col = find_col(["参加"], "pmed-incへの参加")
    enabled_col = find_col(["Copilot", "有効"], "GitHub Copilotの有効/無効")

    wb = Workbook()
    ws = wb.active
    ws.title = "copilot_report"

    team_label = team_slug if team_slug else "全体"
    now_utc = datetime.now(timezone.utc)
    # JSTで表示
    from datetime import timedelta
    jst = timezone(timedelta(hours=JST_OFFSET))
    now_jst = now_utc.astimezone(jst)
    collected_at_str = now_jst.strftime("%Y/%m/%d %H:%M")
    ws.append([f"対象チーム: {team_label}", f"データ収集日時: {collected_at_str}"])
    ws.append([])

    header = [
        "氏名",
        "GitHubユーザー名",
        "pmed-inc参加",
        "Copilot有効/無効",
        "シート割り当て",
        "最終利用日時",
        "最終利用エディタ",
        "シート作成日",
        "シート取消予定日",
    ]
    ws.append(header)

    inactive_users: List[Dict[str, str]] = []
    reported_users = 0
    
    logging.info("ユーザー情報処理開始: %d 名", len(users))

    def nz(v: Any) -> str:
        if v in ("", None):
            return "N/A"
        return str(v)

    # フィルタリング済みユーザーリストを作成
    target_users = []
    for user in users:
        login = nz(user.get("GitHubユーザー名"))
        if login == "N/A":
            continue
        if team_members is not None and login not in team_members:
            continue
        target_users.append(user)
    
    logging.info("対象ユーザー: %d 名", len(target_users))
    
    # シートを持つユーザーの詳細情報を並列取得
    logins_with_seat = [u.get("GitHubユーザー名") for u in target_users 
                        if seat_by_login.get(u.get("GitHubユーザー名"))]
    
    user_details: Dict[str, Optional[Dict[str, Any]]] = {}
    if logins_with_seat:
        logging.info("ユーザー詳細情報を並列取得中: %d 名", len(logins_with_seat))
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_login = {
                executor.submit(fetch_user_seat_details, org, token, login): login
                for login in logins_with_seat
            }
            for future in as_completed(future_to_login):
                login = future_to_login[future]
                try:
                    user_details[login] = future.result()
                except (requests.exceptions.RequestException, ValueError, KeyError) as e:
                    logging.error("ユーザー %s の詳細取得で例外発生: %s", login, e)
                    user_details[login] = None
    
    # Excel書き込み
    for user in target_users:
        name = nz(user.get("氏名"))
        login = nz(user.get("GitHubユーザー名"))
        joined = nz(user.get(joined_col))
        enabled = nz(user.get(enabled_col))

        seat = seat_by_login.get(login)
        has_seat = "あり" if seat else "なし"

        inactive = False
        last_disp = ""
        created_disp = ""
        cancel_disp = ""
        editor = ""

        if seat:
            raw_last = seat.get("last_activity_at") or ""
            raw_created = seat.get("created_at") or ""
            raw_cancel = seat.get("pending_cancellation_date") or ""

            last_disp = format_datetime(raw_last)
            created_disp = format_datetime(raw_created)
            cancel_disp = format_datetime(raw_cancel)

            details = user_details.get(login)
            editor = details.get("last_activity_editor") if details else ""

            last_dt = parse_iso_datetime(raw_last)
            if last_dt is None:
                inactive = True
            else:
                delta = now_utc - last_dt.astimezone(timezone.utc)
                if delta.days >= INACTIVE_DAYS:
                    inactive = True
        else:
            inactive = True

        ws.append(
            [
                name,
                login,
                joined,
                enabled,
                has_seat,
                last_disp,
                editor,
                created_disp,
                cancel_disp,
            ]
        )
        reported_users += 1

        row = ws.max_row
        if inactive:
            ws.cell(row=row, column=1).font = Font(bold=True, color="FFFF0000")
            inactive_users.append(
                {
                    "氏名": name,
                    "GitHubユーザー名": login,
                    "pmed-inc参加": joined,
                    "Copilot有効/無効": enabled,
                    "シート割り当て": has_seat,
                    "最終利用日時": last_disp,
                    "最終利用エディタ": editor,
                    "シート作成日": created_disp,
                    "シート取消予定日": cancel_disp,
                }
            )

    total_users = reported_users
    inactive_count = len(inactive_users)
    active_count = max(total_users - inactive_count, 0)

    if total_users > 0:
        inactive_pct = f"{round(inactive_count / total_users * 100)}%"
        active_pct = f"{round(active_count / total_users * 100)}%"
    else:
        inactive_pct = ""
        active_pct = ""

    for _ in range(3):
        ws.append([""])

    ws.append([""])

    summary_start = ws.max_row + 1
    ws.cell(row=summary_start, column=1).value = f"【{INACTIVE_DAYS}日以上未利用ユーザー（赤字対象）一覧】"

    row = summary_start + 1
    summary_header = [
        "氏名",
        "GitHubユーザー名",
        "pmed-inc参加",
        "Copilot有効/無効",
        "シート割り当て",
        "最終利用日時",
        "最終利用エディタ",
        "シート作成日",
        "シート取消予定日",
    ]
    for col, title in enumerate(summary_header, start=1):
        cell = ws.cell(row=row, column=col)
        cell.value = title
        cell.font = Font(bold=True)

    row += 1
    for iu in inactive_users:
        name_cell = ws.cell(row=row, column=1)
        name_cell.value = iu["氏名"]
        name_cell.font = Font(bold=True, color="FFFF0000")

        ws.cell(row=row, column=2).value = iu["GitHubユーザー名"]
        ws.cell(row=row, column=3).value = iu["pmed-inc参加"]
        ws.cell(row=row, column=4).value = iu["Copilot有効/無効"]
        ws.cell(row=row, column=5).value = iu["シート割り当て"]
        ws.cell(row=row, column=6).value = iu["最終利用日時"]
        ws.cell(row=row, column=7).value = iu["最終利用エディタ"]
        ws.cell(row=row, column=8).value = iu["シート作成日"]
        ws.cell(row=row, column=9).value = iu["シート取消予定日"]

        row += 1

    row += 1
    ws.cell(row=row, column=1).value = f"{INACTIVE_DAYS}日以上未利用ユーザー数"
    ws.cell(row=row, column=2).value = inactive_count
    ws.cell(row=row, column=3).value = inactive_pct

    row += 1
    ws.cell(row=row, column=1).value = f"{INACTIVE_DAYS}日以内に利用したユーザー数"
    ws.cell(row=row, column=2).value = active_count
    ws.cell(row=row, column=3).value = active_pct

    row += 1
    ws.cell(row=row, column=1).value = "総ユーザー数"
    ws.cell(row=row, column=2).value = total_users

    logging.info("統計: 総ユーザー数=%d, 未利用=%d, 利用=%d", total_users, inactive_count, active_count)

    # 保存先ディレクトリ
    output_dir = "./data"
    os.makedirs(output_dir, exist_ok=True)

    # ファイル名（JSTタイムスタンプ付き）
    timestamp = now_jst.strftime("%Y%m%d%H%M%S")
    output = os.path.join(output_dir, f"copilot_report_{timestamp}.xlsx")

    # 保存
    try:
        logging.info("Excel ファイルを保存中: %s", output)
        wb.save(output)
        logging.info("保存完了")
    except PermissionError as e:
        logging.error("レポートファイル '%s' を保存できませんでした。", output)
        logging.error("Excel などでファイルが開かれていないか確認し、閉じてからもう一度実行してください。")
        logging.error("詳細: %s", e)
        sys.exit(1)
    except (OSError, IOError) as e:
        logging.error("予期しないエラーが発生しました: %s", e)
        sys.exit(1)

    print(f"Excel ファイルを出力しました: {output}")

if __name__ == "__main__":
    main()
```
