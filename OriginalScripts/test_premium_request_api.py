#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
GitHub Premium Request Usage API テストスクリプト

新しく発見した Premium Request Usage API をテストして、
個別ユーザーのデータが取得できるか確認します。
"""

import os
import sys
import json
import requests
from datetime import datetime

# .env ファイルを読み込み（簡易版）
def load_env_file(env_path):
    """簡易的な .env ファイル読み込み"""
    if not os.path.exists(env_path):
        return False
    
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()
    return True

if len(sys.argv) > 1:
    env_path = sys.argv[1]
else:
    env_path = ".env"

if load_env_file(env_path):
    print(f"✅ 環境変数を読み込みました: {env_path}")
else:
    print(f"⚠️  .env ファイルが見つかりません: {env_path}")
    sys.exit(1)

# 環境変数取得
GITHUB_TOKEN = os.getenv("NUXT_GITHUB_TOKEN")
GITHUB_ORG = os.getenv("NUXT_PUBLIC_GITHUB_ORG")

if not GITHUB_TOKEN or not GITHUB_ORG:
    print("❌ NUXT_GITHUB_TOKEN または NUXT_PUBLIC_GITHUB_ORG が設定されていません")
    sys.exit(1)

print(f"組織: {GITHUB_ORG}")
print(f"トークン: {GITHUB_TOKEN[:10]}...")
print()

# GitHub API ヘッダー
headers = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
}

# -------------------------
# テスト1: 組織全体のPremium Request使用状況
# -------------------------
def test_org_premium_request():
    """組織全体のPremium Request使用状況を取得"""
    print("=" * 60)
    print("テスト1: 組織全体のPremium Request使用状況")
    print("=" * 60)
    
    url = f"https://api.github.com/organizations/{GITHUB_ORG}/settings/billing/premium_request/usage"
    
    # 今月のデータを取得
    now = datetime.now()
    params = {
        "year": now.year,
        "month": now.month
    }
    
    print(f"URL: {url}")
    print(f"パラメータ: {params}")
    print()
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        
        print(f"ステータスコード: {response.status_code}")
        print(f"レスポンスヘッダー:")
        for key, value in response.headers.items():
            if key.lower() in ['x-ratelimit-remaining', 'x-ratelimit-limit', 'content-type']:
                print(f"  {key}: {value}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            print("✅ 成功！レスポンスデータ:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return True
        elif response.status_code == 404:
            print("❌ 404 Not Found")
            print("このAPIはまだ利用できない可能性があります。")
            print("レスポンスボディ:")
            print(response.text)
            return False
        elif response.status_code == 403:
            print("❌ 403 Forbidden")
            print("権限不足の可能性があります。")
            print("レスポンスボディ:")
            print(response.text)
            return False
        else:
            print(f"❌ エラー: {response.status_code}")
            print("レスポンスボディ:")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"❌ 例外発生: {e}")
        return False


# -------------------------
# テスト2: 特定ユーザーのPremium Request使用状況
# -------------------------
def test_user_premium_request(username):
    """特定ユーザーのPremium Request使用状況を取得"""
    print()
    print("=" * 60)
    print(f"テスト2: ユーザー '{username}' のPremium Request使用状況")
    print("=" * 60)
    
    url = f"https://api.github.com/organizations/{GITHUB_ORG}/settings/billing/premium_request/usage"
    
    # 今月のデータを取得（ユーザーでフィルタリング）
    now = datetime.now()
    params = {
        "year": now.year,
        "month": now.month,
        "user": username  # ← これが重要！
    }
    
    print(f"URL: {url}")
    print(f"パラメータ: {params}")
    print()
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        
        print(f"ステータスコード: {response.status_code}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 成功！ユーザー '{username}' のデータ:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return True
        elif response.status_code == 404:
            print("❌ 404 Not Found")
            print(f"ユーザー '{username}' のデータが見つかりません。")
            print("レスポンスボディ:")
            print(response.text)
            return False
        else:
            print(f"❌ エラー: {response.status_code}")
            print("レスポンスボディ:")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"❌ 例外発生: {e}")
        return False


# -------------------------
# テスト3: 一般的なUsage Report API
# -------------------------
def test_general_usage_report():
    """一般的なUsage Report APIを試す"""
    print()
    print("=" * 60)
    print("テスト3: 一般的なUsage Report API")
    print("=" * 60)
    
    url = f"https://api.github.com/organizations/{GITHUB_ORG}/settings/billing/usage/summary"
    
    now = datetime.now()
    params = {
        "year": now.year,
        "month": now.month
    }
    
    print(f"URL: {url}")
    print(f"パラメータ: {params}")
    print()
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        
        print(f"ステータスコード: {response.status_code}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            print("✅ 成功！レスポンスデータ:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return True
        else:
            print(f"❌ エラー: {response.status_code}")
            print("レスポンスボディ:")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"❌ 例外発生: {e}")
        return False


# -------------------------
# メイン処理
# -------------------------
if __name__ == "__main__":
    print("GitHub Premium Request Usage API テスト")
    print(f"実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # テスト1: 組織全体
    result1 = test_org_premium_request()
    
    # テスト2: 特定ユーザー（組織のメンバーのユーザー名を指定してください）
    if len(sys.argv) > 2:
        test_username = sys.argv[2]
        test_user_premium_request(test_username)
    else:
        print()
        print("=" * 60)
        print("テスト2をスキップ（ユーザー名が指定されていません）")
        print("特定ユーザーをテストするには:")
        print(f"  python {sys.argv[0]} {env_path} <username>")
        print("=" * 60)
    
    # テスト3: 一般的なUsage Report
    result3 = test_general_usage_report()
    
    print()
    print("=" * 60)
    print("テスト完了")
    print("=" * 60)
    
    if result1:
        print("✅ Premium Request APIは利用可能です！")
        print("   個別ユーザーのデータ取得を実装できる可能性があります。")
    else:
        print("❌ Premium Request APIは現時点では利用できません。")
        print("   2025年8月以降の新機能のため、段階的に展開されている可能性があります。")
