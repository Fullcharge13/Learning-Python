import os
import sys

# runner.py는 src/py 아래에 있다(Pyodide 작업자가 같은 파일을 올림).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src", "py"))
