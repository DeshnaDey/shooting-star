"""
JWT verification, matching backend/app/core/security.py's exact scheme
(HS256, "sub" claim = user id, same JWT_SECRET) so a token issued by the
real login endpoint works here too - one login, both services trust it.

Previously this service trusted a client-supplied user_id directly, which
meant anyone could redeem points as a different user by editing the request
body. This closes that gap: the user_id is now taken ONLY from a verified
token, never from anything the client sends.
"""
import os
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")  # must match backend's
_bearer = HTTPBearer(auto_error=False)


def get_current_user_id(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> int:
    if creds is None:
        raise HTTPException(401, "not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "invalid or expired token")
