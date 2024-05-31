#!/usr/bin/env python3
from jwt import JWT, jwk_from_pem
import time
import sys

# Get PEM file path
if len(sys.argv) > 1:
    pem = sys.argv[1]
else:
    pem = input("Enter path of private PEM file: ")

# Get the Client ID
if len(sys.argv) > 2:
    client_id = sys.argv[2]
else:
    client_id = input("Enter your Client ID: ")

# Open PEM
with open(pem, 'rb') as pem_file:
    signing_key = jwk_from_pem(pem_file.read())

payload = {
    # Issued at time
    'iat': int(time.time()),
    # JWT expiration time (10 minutes maximum)
    'exp': int(time.time()) + 600,
    
    # GitHub App's client ID
    'iss': client_id
}
#  PEM Path "/Users/martedesco/Desktop/Metrics PEM/copilot-metrics-github-app.2024-05-24.private-key.pem"
# Client ID Iv23ctf7DOF0Tw7uHIsH
# Create JWT
# JWT
# eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpYXQiOiAxNzE2NTg2NTgxLCAiZXhwIjogMTcxNjU4NzE4MSwgImlzcyI6ICJJdjIzY3RmN0RPRjBUdzd1SElzSCJ9.zqvfpi4NfY4w0Me1z6e3B-umtcjWjzQ2UuB-2XdmOGNNhOyrkb5CK-ucOjwAtbk6ObPnYJOKhoMluMwe965uq46X74eZdDlnvxNkNa-qDTmleN5GzHAWDT_lVjp13doSjVALKsMovbdtA6pKdQn0KlOj2u--_dVSz203ug4vSk7GvBIuigyfc-UCHs-DtPLGmzFmp2KxztaE1bgXAgtfkRhj75MpQuNii3-FICa9GhgpF2Q_1-TOr-ZtQV2GVLHEhhjuwh6EKcgQiBg9ne7Vn84NtZnzmSpb-3FIOAh2FR7YwBLo5u4jYFRY06LY53j087JdCRYbrFeuqj33o_bwEg
jwt_instance = JWT()
encoded_jwt = jwt_instance.encode(payload, signing_key, alg='RS256')

print(f"JWT:  {encoded_jwt}")
