
import os
import re

file_path = r'e:\project\workspace\WOS-Commander\app\growth\events.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Ensure the parent container of the slots allows 2 columns properly
# Root cause might be the gap-1.5 combined with 49% adding up to more than 100% (due to border/padding)
# We change to 48% and use justify-between for the gap management.
old_container = '<View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>'
# Let's use a very clean container
new_container = '<View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", width: "100%" }}>'

content = content.replace(old_container, new_container)

# 2. Update the slot width to 48% to be safe and ensure it wraps
# Also make sure the border-box (default in RN) is respected.
old_slot_style = 'style={{ width: "49%", marginBottom: 8 }} className={`border px-2 py-1.5 rounded-xl flex-row items-center justify-between '
new_slot_style = 'style={{ width: "48%", marginBottom: 8 }} className={`border px-2 py-1.5 rounded-xl flex-row items-center justify-between '

content = content.replace(old_slot_style, new_slot_style)

# 3. Check for any other width constraints in the path
# The container from Step 2226 was px-2, let's make it px-1 to maximize horizontal space
content = content.replace('className="px-2 flex-1"', 'className="px-1 flex-1"')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Forced 48% width and minimized container padding to guarantee 2-column layout.")
