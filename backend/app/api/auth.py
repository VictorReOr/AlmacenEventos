from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.models.schemas import LoginRequest, GoogleLoginRequest, Token, User
from app.services.auth_service import auth_service
from app.core.security import create_access_token, verify_token

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email = payload.get("sub")
    if not email:
         raise HTTPException(status_code=401, detail="Invalid token payload")
         
    # Verify user still exists in DB (Sheet)
    user_data = auth_service.get_user_from_sheet(email)
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found")
        
    return User(
        email=user_data["USER_ID"],
        role=user_data["ROLE"],
        name=user_data.get("NAME"),
        is_active=True
    )

@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    user = auth_service.authenticate_user(request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user["USER_ID"], "role": user["ROLE"]})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user": {
            "email": user["USER_ID"],
            "role": user["ROLE"],
            "name": user.get("NAME"),
            "is_active": True
        }
    }

@router.post("/google-login", response_model=Token)
async def google_login(request: GoogleLoginRequest):
    email = auth_service.verify_google_token(request.token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid Google Token")
    
    user = auth_service.get_user_from_sheet(email)
    if not user:
        raise HTTPException(status_code=403, detail="User not authorized in system")
        
    access_token = create_access_token(data={"sub": user["USER_ID"], "role": user["ROLE"]})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user": {
            "email": user["USER_ID"],
            "role": user["ROLE"],
            "name": user.get("NAME"),
            "is_active": True
        }
    }
