from google.cloud import vision
from google.oauth2 import service_account
import json
import base64
from app.core.config import get_settings

settings = get_settings()

class VisionService:
    def __init__(self):
        self.client = None
        self._init_client()

    def _init_client(self):
        try:
            if settings.GOOGLE_APPLICATION_CREDENTIALS_JSON:
                info = json.loads(settings.GOOGLE_APPLICATION_CREDENTIALS_JSON)
                creds = service_account.Credentials.from_service_account_info(info)
                self.client = vision.ImageAnnotatorClient(credentials=creds)
                print("VISION: Client initialized via JSON Env Var.")
            else:
                # Fallback: Try loading from local file
                import os
                if os.path.exists("service_account.json"):
                    creds = service_account.Credentials.from_service_account_file("service_account.json")
                    self.client = vision.ImageAnnotatorClient(credentials=creds)
                    print("VISION: Client initialized via local file.")
                else:
                    print("VISION: No credentials provided (Env or File).")
        except Exception as e:
            print(f"VISION: Init failed. {e}")

    def detect_text(self, image_base64: str) -> str:
        if not self.client:
            self._init_client()
            if not self.client:
                return "OCR Service Unavailable (No Creds)"
        
        try:
            # Decode base64
            # Handle data:image/png;base64,... header if present
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
                
            content = base64.b64decode(image_base64)
            image = vision.Image(content=content)
            
            response = self.client.text_detection(image=image)
            texts = response.text_annotations
            
            if response.error.message:
                raise Exception(response.error.message)

            if texts:
                # texts[0] is the full text
                return texts[0].description
            return ""
            
        except Exception as e:
            print(f"VISION ERROR: {e}")
            return f"Error processing image: {str(e)}"

vision_service = VisionService()
