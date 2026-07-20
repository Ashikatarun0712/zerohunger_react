import re

with open('css/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

target = """.chat-toggle{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--g2),var(--t1));border:3px solid rgba(255,255,255,0.4);cursor:pointer;box-shadow:0 8px 24px rgba(13,148,136,0.4);display:flex;align-items:center;justify-content:center;font-size:28px;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);margin-left:auto;position:relative;animation:floatChat 3s ease-in-out infinite}
.chat-toggle:hover{transform:scale(1.15) translateY(-4px);box-shadow:0 12px 32px rgba(13,148,136,0.6);background:linear-gradient(135deg,var(--t1),var(--g1))}
.chat-toggle::after{content:'';position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#ef4444;border:2px solid #fff;border-radius:50%;animation:pulseChatNotif 2s infinite}
@keyframes floatChat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes pulseChatNotif{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,0.7)}50%{transform:scale(1.1);box-shadow:0 0 0 6px rgba(239,68,68,0)}}"""

replacement = """.chat-toggle{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#10b981,#0ea5e9);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:30px;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);margin-left:auto;position:relative;animation:floatChat 3s ease-in-out infinite;box-shadow:0 0 0 0 rgba(16,185,129,0.7)}
.chat-toggle::before{content:'';position:absolute;inset:-6px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#10b981);z-index:-1;opacity:0.6;filter:blur(10px);animation:pulseGlow 2.5s infinite alternate}
.chat-toggle:hover{transform:scale(1.15) translateY(-5px);box-shadow:0 15px 35px rgba(14,165,233,0.5)}
.chat-toggle:hover::before{opacity:1;filter:blur(14px)}
.chat-toggle::after{content:'';position:absolute;top:0;right:0;width:16px;height:16px;background:#ef4444;border:3px solid #fff;border-radius:50%;animation:pulseChatNotif 2s infinite}
@keyframes pulseGlow{0%{transform:scale(0.9);opacity:0.4}100%{transform:scale(1.15);opacity:0.8}}
@keyframes floatChat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes pulseChatNotif{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,0.7)}50%{transform:scale(1.1);box-shadow:0 0 0 6px rgba(239,68,68,0)}}"""

content = content.replace(target, replacement)
with open('css/style.css', 'w', encoding='utf-8') as f:
    f.write(content)
