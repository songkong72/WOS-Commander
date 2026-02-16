
import os

file_path = r'e:\project\workspace\WOS-Commander\app\growth\events.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Restore the font size to text-xs as requested
content = content.replace(
    '<Text className="text-white text-[10px] font-bold">',
    '<Text className="text-white text-xs font-bold">'
)

# 2. Adjust button width and styling to ensure 2 columns by shrinking the box slightly more
# We'll use w-[47%] and reduce the gap to gap-1.5 or gap-1 to be safer on 360px
content = content.replace(
    'className="flex-row flex-wrap gap-2">',
    'className="flex-row flex-wrap gap-2 justify-between">' # Use justify-between for better alignment
)

content = content.replace(
    'w-[48.5%]',
    'w-[48.8%]' # Let's keep a tight percentage but use justify-between on parent
)

# If it's still not wrapping, maybe it's the padding/margin.
# Let's try 48% to be safe.
content = content.replace('w-[48.8%]', 'w-[48.5%]')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Restored font size and adjusted box layout for 2-column fortress slots.")
