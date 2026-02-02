
import os
import re

files = [
    r'e:\project\workspace\WOS-Commander\app\index.tsx',
    r'e:\project\workspace\WOS-Commander\app\growth\events.tsx'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Apply the ultra-wide background fix
    # We look for the ImageBackground style and force it to be 100vw on web
    
    # Update style to be absolute and full width
    content = re.sub(
        r"style=\{\{\s*position:\s*'absolute',\s*top:\s*0,\s*left:\s*0,\s*right:\s*0,\s*bottom:\s*0,\s*width:\s*'100%',\s*height:\s*'100%'\s*\}\}",
        "style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', minWidth: Platform.OS === 'web' ? '100vw' : '100%' }}",
        content
    )
    
    # Update imageStyle to ensure objectFit cover and viewport width
    content = re.sub(
        r"imageStyle=\{\{\s*resizeMode:\s*'cover',\s*\.\.\.Platform\.select\(\{\s*web:\s*\{\s*objectFit:\s*'cover',\s*\}\s*as\s*any\s*\}\)\s*\}\}",
        "imageStyle={{ resizeMode: 'cover', width: Platform.OS === 'web' ? '100vw' : '100%', height: Platform.OS === 'web' ? '100vh' : '100%', ...Platform.select({ web: { objectFit: 'cover' } as any }) }}",
        content
    )

    # Ensure the overlay also covers 100vw
    content = content.replace('className="flex-1 bg-black/60 w-full"', 'className="flex-1 bg-black/60 w-full" style={{ minWidth: Platform.OS === "web" ? "100vw" : "100%" }}')
    content = content.replace('className="flex-1 bg-black/70 flex-row w-full h-full"', 'className="flex-1 bg-black/70 flex-row w-full h-full" style={{ minWidth: Platform.OS === "web" ? "100vw" : "100%" }}')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Ultra-wide background fix applied to both files.")
