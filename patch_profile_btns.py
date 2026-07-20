import re

with open('profile.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """    <div id="user-trust-card" style="margin-bottom:20px"></div>
    <div class="module-grid" id="prof-modules"></div>"""

replacement = """    <div id="user-trust-card" style="margin-bottom:20px"></div>
    
    <!-- Animated History Metric Buttons -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-bottom:20px;" id="history-metrics-container">
      <div onclick="window.location.href='history_donations.html'" style="background:linear-gradient(135deg,var(--t1),var(--g1));color:#fff;padding:20px;border-radius:16px;cursor:pointer;box-shadow:0 8px 24px rgba(13,148,136,0.25);position:relative;overflow:hidden;transition:all .3s ease;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 32px rgba(13,148,136,0.4)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 8px 24px rgba(13,148,136,0.25)';">
        <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(255,255,255,0.1);border-radius:50%;animation:pulseGlow 3s infinite"></div>
        <div style="display:flex;align-items:center;gap:14px;position:relative;z-index:1">
          <div style="font-size:2.8rem">📜</div>
          <div>
            <div style="font-size:.9rem;opacity:.9;font-weight:600;text-transform:uppercase;letter-spacing:1px">My Donations</div>
            <div style="font-size:2.2rem;font-weight:800;line-height:1.1" id="btn-count-don">0</div>
            <div style="font-size:.8rem;opacity:.9;margin-top:4px">View detailed history & charts ↗</div>
          </div>
        </div>
      </div>
      
      <div onclick="window.location.href='history_requests.html'" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;padding:20px;border-radius:16px;cursor:pointer;box-shadow:0 8px 24px rgba(59,130,246,0.25);position:relative;overflow:hidden;transition:all .3s ease;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 32px rgba(59,130,246,0.4)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 8px 24px rgba(59,130,246,0.25)';">
        <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(255,255,255,0.1);border-radius:50%;animation:pulseGlow 3s infinite"></div>
        <div style="display:flex;align-items:center;gap:14px;position:relative;z-index:1">
          <div style="font-size:2.8rem">📥</div>
          <div>
            <div style="font-size:.9rem;opacity:.9;font-weight:600;text-transform:uppercase;letter-spacing:1px">My Requests</div>
            <div style="font-size:2.2rem;font-weight:800;line-height:1.1" id="btn-count-req">0</div>
            <div style="font-size:.8rem;opacity:.9;margin-top:4px">View received items & charts ↗</div>
          </div>
        </div>
      </div>
    </div>

    <div class="module-grid" id="prof-modules"></div>"""

if "history-metrics-container" not in content:
    content = content.replace(target, replacement)
    with open('profile.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched profile.html")
else:
    print("Already patched profile.html")
