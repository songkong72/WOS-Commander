
import re

file_path = r'e:\project\workspace\WOS-Commander\app\growth\events.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

def count_tags(tag, content):
    opens = len(re.findall(f'<{tag}[\\s/>]', content))
    closes = len(re.findall(f'</{tag}[\\s/>]', content))
    return opens, closes

tags = ['View', 'Pressable', 'TouchableOpacity', 'Modal', 'Text', 'ScrollView']
for tag in tags:
    o, c = count_tags(tag, content)
    print(f"{tag}: {o} / {c} (Diff: {o-c})")
