import re

with open('css/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update .cert-metrics for 5 tiles instead of 4
target1 = ".cert-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}"
replacement1 = ".cert-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin-bottom:14px}"
content = content.replace(target1, replacement1)

target1_mob1 = ".cert-metrics{grid-template-columns:repeat(2,1fr)}"
replacement1_mob1 = ".cert-metrics{grid-template-columns:repeat(3,1fr)}"
content = content.replace(target1_mob1, replacement1_mob1)

target1_mob2 = ".cert-metrics{grid-template-columns:1fr}"
replacement1_mob2 = ".cert-metrics{grid-template-columns:repeat(2,1fr)}"
content = content.replace(target1_mob2, replacement1_mob2)


# 2. Update .chat-toggle button
target2 = """.chat-toggle{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--g2),var(--t1));border:none;cursor:pointer;box-shadow:var(--shadow-lg);display:flex;align-items:center;justify-content:center;font-size:24px;transition:var(--transition);margin-left:auto}
.chat-toggle:hover{transform:scale(1.08)}"""

replacement2 = """.chat-toggle{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--g2),var(--t1));border:3px solid rgba(255,255,255,0.4);cursor:pointer;box-shadow:0 8px 24px rgba(13,148,136,0.4);display:flex;align-items:center;justify-content:center;font-size:28px;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);margin-left:auto;position:relative;animation:floatChat 3s ease-in-out infinite}
.chat-toggle:hover{transform:scale(1.15) translateY(-4px);box-shadow:0 12px 32px rgba(13,148,136,0.6);background:linear-gradient(135deg,var(--t1),var(--g1))}
.chat-toggle::after{content:'';position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#ef4444;border:2px solid #fff;border-radius:50%;animation:pulseChatNotif 2s infinite}
@keyframes floatChat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes pulseChatNotif{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,0.7)}50%{transform:scale(1.1);box-shadow:0 0 0 6px rgba(239,68,68,0)}}"""
content = content.replace(target2, replacement2)


with open('css/style.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched style.css successfully!")
