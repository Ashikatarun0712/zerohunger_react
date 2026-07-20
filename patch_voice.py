import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add P2P voice button
target_p2p = """        chatInputHtml = `
            <div style="padding:12px 14px;border-top:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;background:#fafafa">
                <input type="text" id="p2p-chat-input" placeholder="Type a message..." style="flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:20px;outline:none;font-size:.85rem;background:#fff;transition:border .2s" onfocus="this.style.border='1.5px solid #10b981'" onblur="this.style.border='1.5px solid #e2e8f0'">
                <button style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:10px 18px;border-radius:20px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.3);transition:transform .15s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="sendP2PMessage(${donationId}, '${otherUser}', ${isDonor})">Send ↗</button>
            </div>
        `;"""

replacement_p2p = """        chatInputHtml = `
            <div style="padding:12px 14px;border-top:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;background:#fafafa">
                <input type="text" id="p2p-chat-input" placeholder="Type a message..." style="flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:20px;outline:none;font-size:.85rem;background:#fff;transition:border .2s" onfocus="this.style.border='1.5px solid #10b981'" onblur="this.style.border='1.5px solid #e2e8f0'">
                <button style="background:#fff;color:var(--g1);border:1px solid var(--border);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" onclick="startChatVoice('p2p-chat-input', false)" title="Voice typing">🎤</button>
                <button style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:10px 18px;border-radius:20px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.3);transition:transform .15s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="sendP2PMessage(${donationId}, '${otherUser}', ${isDonor})">Send ↗</button>
            </div>
        `;"""

content = content.replace(target_p2p, replacement_p2p)

# 2. Add startChatVoice function
voice_logic = """
let chatVoiceRec = null;
function startChatVoice(inputId, autoSend) {
    if (!checkVoiceSupport()) { toast('⚠️ Voice not supported in this browser.', 'err'); return; }
    if (chatVoiceRec) {
        try { chatVoiceRec.stop(); } catch(e){}
        chatVoiceRec = null;
        return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    chatVoiceRec = new SR();
    chatVoiceRec.lang = 'en-IN';
    chatVoiceRec.interimResults = true;
    
    chatVoiceRec.onstart = () => toast('🎤 Listening...', 'info', 2000);
    chatVoiceRec.onresult = (ev) => {
        let text = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
            text += ev.results[i][0].transcript;
        }
        const inputEl = document.getElementById(inputId);
        if (inputEl) inputEl.value = text;
    };
    chatVoiceRec.onend = () => {
        chatVoiceRec = null;
        if (autoSend && document.getElementById(inputId).value.trim() !== '') {
            if (inputId === 'chat-input') sendChat();
        }
    };
    chatVoiceRec.onerror = () => { chatVoiceRec = null; toast('⚠️ Voice recognition failed', 'err'); };
    
    try { chatVoiceRec.start(); } catch(e) { chatVoiceRec = null; }
}
"""
if "function startChatVoice" not in content:
    content += "\n" + voice_logic

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched app.js with voice features!")
