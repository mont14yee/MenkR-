import os
import re

directories = ['src', 'public', '.']
files_to_check = ['index.html', 'package.json', 'SMOKE_TEST.md']

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return

    new_content = content.replace('ConneQ', 'MenkiR')
    new_content = new_content.replace('conneq', 'menkir')

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.css', '.html')):
            replace_in_file(os.path.join(root, file))

for root, _, files in os.walk('public'):
    for file in files:
        if file.endswith(('.json', '.html')):
            replace_in_file(os.path.join(root, file))

for file in files_to_check:
    if os.path.exists(file):
        replace_in_file(file)

print("Done")
