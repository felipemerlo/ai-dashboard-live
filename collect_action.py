#!/usr/bin/env python3
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import server

def main():
    try:
        data = server.load_data()
    except Exception:
        data = {"title":"Dashboard de Inteligência Artificial","period":"","takeaways":[],"sections":{}}
    data = server.merge_update(data)
    server.save_data(data)
    print('Wrote', server.DATA_PATH)

if __name__ == '__main__':
    main()
