from typing import Optional, Dict
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests
from app.services.sheets_service import sheet_service
from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    def verify_password(self, plain_password, hashed_password):
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False

    def get_password_hash(self, password):
        return pwd_context.hash(password)

    def get_user_from_sheet(self, email: str) -> Optional[Dict]:
        users = sheet_service.get_users()
        # Header: USER_ID, ROLE, NAME, PASSWORD
        for user in users:
            if user.get("USER_ID") == email:
                return user
        return None

    def authenticate_user(self, email: str, password: str):
        user = self.get_user_from_sheet(email)
        if not user:
            return None
        
        # Check password
        stored_hash = user.get("PASSWORD")
        if not stored_hash:
             return None # Manual login requires password
             
        if self.verify_password(password, stored_hash):
            return user
        return None

    def verify_google_token(self, token: str) -> Optional[str]:
        """Verifies Google ID Token and returns the email if valid."""
        try:
            # Verify token signature. 
            # Note: For production, Pass your Google Client ID as the third argument.
            id_info = id_token.verify_oauth2_token(token, requests.Request())
            
            email = id_info.get("email")
            return email
        except ValueError as e:
            print(f"AUTH: Invalid Google Token. {e}")
            return None

auth_service = AuthService()
