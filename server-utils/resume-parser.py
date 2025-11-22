
import sys
import json
import os
from pyresparser import ResumeParser
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

def parse_resume(file_path):
    try:
        if not os.path.exists(file_path):
            print(json.dumps({"error": "File not found"}))
            return

        data = ResumeParser(file_path).get_extracted_data()
        print(json.dumps({"success": True, "data": data}, default=str))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    parse_resume(file_path)
