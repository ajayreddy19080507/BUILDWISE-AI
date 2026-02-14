from flask import Flask, render_template, request, jsonify
import json
import math 
import os
from openai import OpenAI 
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# --- CONFIGURATION ---
# The API key is read from the .env file for security
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize Groq Client
if GROQ_API_KEY:
    client = OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )
else:
    client = None
    print("⚠️ WARNING: GROQ_API_KEY not found. Please check your .env file.")

# Modern Llama 3.3 Model for both logic and conversation
AI_MODEL = "llama-3.3-70b-versatile"

# --- CALCULATION LOGIC ---
class ConstructionCalculator:
    def __init__(self, built_up_area, floors, cost_per_sq_yard=1500):
        self.built_up_area = float(built_up_area)
        self.num_floors = self.parse_floors(floors)
        self.cost_per_sq_yard = float(cost_per_sq_yard)

        # Standard Engineering Ratios
        self.STEEL_PER_SQ_YARD = 3.5
        self.CEMENT_PER_SQ_YARD = 0.4
        self.SAND_PER_SQ_YARD = 0.6

    def parse_floors(self, floors_str):
        if isinstance(floors_str, int): return floors_str
        floors_str = str(floors_str).upper().replace(" ", "")
        if "G+" in floors_str:
            try: return int(floors_str.split("+")[1]) + 1
            except: return 1
        try: return int(floors_str)
        except: return 1

    def generate_blueprint_data(self):
        floors_data = []
        scale_factor = math.sqrt(self.built_up_area / 1000)
        
        layout_template = [
            {"name": "Living Hall", "x": 0, "y": 40, "w": 60, "h": 60, "color": "#3b82f6"},
            {"name": "Kitchen",     "x": 60, "y": 40, "w": 40, "h": 60, "color": "#ef4444"},
            {"name": "Master Bed",  "x": 0, "y": 0,  "w": 50, "h": 40, "color": "#10b981"},
            {"name": "Bedroom 2",   "x": 50, "y": 0, "w": 30, "h": 40, "color": "#8b5cf6"},
            {"name": "Bath",        "x": 80, "y": 0, "w": 20, "h": 40, "color": "#06b6d4"},
        ]

        for i in range(self.num_floors):
            floor_name = "Ground Floor" if i == 0 else f"Floor {i}"
            current_rooms = []
            for room in layout_template:
                current_rooms.append({
                    "name": room['name'],
                    "x": room['x'], "y": room['y'], "w": room['w'], "h": room['h'],
                    "color": room['color']
                })
            floors_data.append({"floor_name": floor_name, "rooms": current_rooms})
        return floors_data

    def calculate_materials(self):
        factor = self.built_up_area * self.num_floors
        return {
            "steel_tons": round((factor * self.STEEL_PER_SQ_YARD) / 1000, 2),
            "cement_bags": round(factor * self.CEMENT_PER_SQ_YARD, 0),
            "sand_tons": round(factor * self.SAND_PER_SQ_YARD, 2)
        }

    def calculate_cost(self):
        materials = self.calculate_materials()
        mat_cost = (materials["steel_tons"] * 60000) + \
                   (materials["cement_bags"] * 420) + \
                   (materials["sand_tons"] * 8000)
        
        total_est = self.built_up_area * self.num_floors * self.cost_per_sq_yard
        labor_cost = total_est * 0.30
        overhead = total_est * 0.10
        
        return {
            "material_cost": round(mat_cost, 2),
            "labor_cost": round(labor_cost, 2),
            "overhead_cost": round(overhead, 2),
            "total_estimated_cost": round(mat_cost + labor_cost + overhead, 2)
        }

# --- GROQ AI: SCHEDULE GENERATION ---
def generate_ai_schedule(area, floors):
    if not client: return get_fallback_schedule()

    prompt = f"Create a detailed construction schedule for a {area} sq yard, {floors} building. Return ONLY a JSON array. Format: [{{'week': '1-2', 'phase': 'Excavation', 'activities': ['Digging']}}]"
    
    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a JSON generator. Output only raw JSON."},
                {"role": "user", "content": prompt}
            ],
            model=AI_MODEL,
            temperature=0.1,
        )
        ai_text = completion.choices[0].message.content
        start, end = ai_text.find('['), ai_text.rfind(']')
        return json.loads(ai_text[start:end+1]) if start != -1 else get_fallback_schedule()
    except:
        return get_fallback_schedule()

def get_fallback_schedule():
    return [{"week": "1-2", "phase": "Site Prep", "activities": ["Site Cleaning", "Marking"]}]

# --- ROUTES ---
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/calculate", methods=["POST"])
def api_calculate():
    try:
        data = request.json
        calc = ConstructionCalculator(
            built_up_area=data.get("built_up_area", 1000),
            floors=data.get("floors", "G+2"),
            cost_per_sq_yard=data.get("cost_per_sq_yard", 1500)
        )
        return jsonify({
            "materials": calc.calculate_materials(),
            "costs": calc.calculate_cost(),
            "blueprint": calc.generate_blueprint_data(),
            "schedule": generate_ai_schedule(calc.built_up_area, data.get("floors"))
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- GROQ AI: CHATBOT ---
@app.route("/api/chat", methods=["POST"])
def api_chat():
    if not client: return jsonify({"reply": "API Key missing."})
    try:
        data = request.json
        user_msg = data.get("message", "")
        
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are 'BuildAI Bot', an expert Civil Engineer. Use **Double Asterisks** for headings."},
                {"role": "user", "content": user_msg}
            ],
            model=AI_MODEL,
            temperature=0.7,
            max_tokens=300
        )
        return jsonify({"reply": completion.choices[0].message.content})
    except Exception as e:
        return jsonify({"reply": f"Error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)