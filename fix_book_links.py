import re
from pathlib import Path

root = Path(__file__).resolve().parent
pattern = re.compile(r'href=(?P<q>["\'])(?:#appointment|#)(?P=q)(?=[^>]*>[^<]*Book Appointment)', re.IGNORECASE)
updated = []
for path in root.rglob('*.html'):
    text = path.read_text(encoding='utf-8')
    new_text, count = pattern.subn('href="contact.html"', text)
    if count:
        path.write_text(new_text, encoding='utf-8')
        updated.append((path.name, count))
print(f'Updated {len(updated)} files:')
for name, count in updated:
    print(f'- {name}: {count} replacements')
