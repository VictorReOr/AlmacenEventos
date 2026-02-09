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
            # Handle potential header variations (USER_ID vs USER ID vs ID vs EMAIL)
            user_email = user.get("USER_ID") or user.get("USER ID") or user.get("ID") or user.get("EMAIL")
            # print(f"DEBUG: Checking user {user_email} against {email}")
            
            if user_email and str(user_email).strip() == str(email).strip():
                # Normalize keys for the rest of the app to ensure consistency
                user["USER_ID"] = user_email
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
             
        # 1. Try secure hash verification
        if self.verify_password(password, stored_hash):
            user["ROLE"] = str(user["ROLE"]).upper()
            return user
            
        # 2. Fallback: Plain text comparison (for manually edited Sheets)
        # WARNING: In production, always use hashes.
        if str(stored_hash).strip() == password.strip():
            user["ROLE"] = str(user["ROLE"]).upper()
            return user
            
        return None

    def verify_google_token(self, token: str) -> Optional[str]:
        """Verifies Google ID Token and returns the email if valid."""
        try:
            # Verify token signature. 
            # We strictly check the audience now.
            client_id = settings.GOOGLE_CLIENT_ID
            if not client_id:
                print("WARNING: GOOGLE_CLIENT_ID not set in backend config. Skipping audience check.")
                id_info = id_token.verify_oauth2_token(token, requests.Request())
            else:
                id_info = id_token.verify_oauth2_token(token, requests.Request(), audience=client_id)
            
            email = id_info.get("email")
            return email
        except ValueError as ve:
            print(f"AUTH ERROR: Token validation error: {ve}")
            return None
        except Exception as e:
            print(f"AUTH ERROR: Google Token Verification Failed. Type: {type(e).__name__}, Error: {e}")
            import traceback
            traceback.print_exc()
            return None

    def create_user(self, email: str, name: str, role: str = "VISITOR"):
        user_data = {
            "email": email,
            "name": name,
            "role": role.upper() # Ensure role is always uppercase
        }
        sheet_service.add_user(user_data)
        return user_data

auth_service = AuthService()
