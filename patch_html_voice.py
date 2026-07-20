import glob

for fpath in glob.glob('*.html'):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    target = """    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="Ask anything…" onkeydown="if(event.key==='Enter')sendChat()">
      <button class="chat-send" onclick="sendChat()">➤</button>
    </div>"""
    
    replacement = """    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="Ask anything…" onkeydown="if(event.key==='Enter')sendChat()">
      <button class="chat-send" style="background:#f8fafc;color:var(--g1);border:1px solid var(--border);box-shadow:none" onclick="startChatVoice('chat-input', true)" title="Voice to AI">🎤</button>
      <button class="chat-send" onclick="sendChat()">➤</button>
    </div>"""
    
    if target in content:
        content = content.replace(target, replacement)
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {fpath}")
