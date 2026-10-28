"""AST audit of Python service runtime; comments and SQL bind parameters are ignored."""
import ast
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
methods = {'find_one', 'find_many', 'insert_one', 'insert_many', 'update_one', 'update_many',
           'delete_one', 'delete_many', 'find_one_and_update', 'aggregate', 'bulk_write'}
findings = []
scanned = 0
for file in sorted((root / 'services').rglob('*.py')):
    if any(part in {'node_modules', '.venv', 'venv', '__pycache__', 'tests'} for part in file.parts) or file.name.startswith('test_'):
        continue
    scanned += 1
    tree = ast.parse(file.read_text(encoding='utf-8-sig'), filename=str(file))
    for node in ast.walk(tree):
        value = None
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in methods:
            value = node.func.attr
        elif isinstance(node, ast.Dict):
            keys = [key.value for key in node.keys if isinstance(key, ast.Constant) and isinstance(key.value, str) and key.value.startswith('$')]
            if keys:
                value = ','.join(keys)
        elif isinstance(node, ast.Import):
            value = next((alias.name for alias in node.names if alias.name.split('.')[0] in {'pymongo', 'motor', 'bson'}), None)
        elif isinstance(node, ast.ImportFrom) and (node.module or '').split('.')[0] in {'pymongo', 'motor', 'bson'}:
            value = node.module
        if value:
            findings.append({'file': file.relative_to(root).as_posix(), 'line': node.lineno, 'value': value})
print(json.dumps({'complete': not findings, 'scannedFiles': scanned, 'findings': findings}))
