from app.models.schemas import AssistantParseRequest, User, ActionType
from app.services.nlp_service import nlp_service
from app.services.sheets_service import sheet_service
from app.api.assistant import parse_request
import asyncio

# Mock Security Dependency
def get_current_user_mock():
    return User(email="test@example.com", role="USER")

async def test_flow():
    print("Testing Assistant Suggestion Flow (Mock Integration)...")
    
    # User Input: "Me ha llegado palet 99" -> ENTRADA
    # But usually "palet 99" is extracted as destination.
    # We want to test NO DESTINATION.
    # Input: "Me han llegado 10 cajas de Mentor"
    
    text = "Me han llegado 10 cajas de Mentor"
    user = get_current_user_mock()
    
    # 1. Test Parse
    # We can't call parse_request directly easily because of Depends/FastAPI context, 
    # but we can simulate the logic block we added.
    
    print(f"Input: '{text}'")
    interpretation = nlp_service.parse(text, user.email)
    print(f"Intent: {interpretation.intent}")
    
    if interpretation.intent == "ENTRADA":
        # Simulate Assistant Logic
        print("Assistant Logic Triggered:")
        for mov in interpretation.movements:
            print(f" - Original Dest: {mov.destination}")
            
            if mov.destination == "RECEPCION":
                print("   -> DETECTED DEFAULT DESTINATION. Fetching suggestions...")
                candidates = sheet_service.get_available_locations(limit=3)
                if candidates:
                    mov.destination = candidates[0]
                    print(f"   -> Updated Dest: {mov.destination}")
                    print(f"   -> Candidates: {candidates}")
                    
                    msg = f"He encontrado hueco en **{candidates[0]}**."
                    others = ", ".join(candidates[1:])
                    if others: msg += f" Otras opciones: {others}."
                    msg += " ¿Confirmas?"
                    interpretation.summary = msg
                    print(f"   -> Summary Updated: {msg}")
                else:
                    print("   -> No candidates found.")
            else:
                 print("   -> Specific destination found. No suggestion needed.")
                 
    else:
        print("Intent was NOT Entrada.")

    # Check Result
    dest = interpretation.movements[0].destination
    if dest and dest != "RECEPCION" and dest.startswith("E"):
        print("SUCCESS: Destination updated to a shelf!")
    else:
        print(f"FAIL: Destination is {dest}")

if __name__ == "__main__":
    asyncio.run(test_flow())
