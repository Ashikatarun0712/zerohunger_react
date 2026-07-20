import re

# 1. Update app.js loadProfile() to call updateProfileHistoryCounts()
with open('js/app.js', 'r', encoding='utf-8') as f:
    content_app = f.read()

target_app = "  checkMicroVolunteerAlert();\n}"
replacement_app = "  checkMicroVolunteerAlert();\n  if (typeof updateProfileHistoryCounts === 'function') updateProfileHistoryCounts();\n}"

if "updateProfileHistoryCounts();\n}" not in content_app:
    content_app = content_app.replace(target_app, replacement_app)
    with open('js/app.js', 'w', encoding='utf-8') as f:
        f.write(content_app)


# 2. Update profile.html to use classes for the buttons
with open('profile.html', 'r', encoding='utf-8') as f:
    content_prof = f.read()

target_prof = """    <!-- Animated History Metric Buttons -->
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
    </div>"""

replacement_prof = """    <!-- Animated History Metric Buttons -->
    <div class="history-metrics-container" id="history-metrics-container">
      <div onclick="window.location.href='history_donations.html'" class="history-metric-btn don-btn">
        <div class="hm-glow"></div>
        <div class="hm-inner">
          <div class="hm-icon">📜</div>
          <div>
            <div class="hm-title">My Donations</div>
            <div class="hm-count" id="btn-count-don">0</div>
            <div class="hm-sub">View detailed history ↗</div>
          </div>
        </div>
      </div>
      
      <div onclick="window.location.href='history_requests.html'" class="history-metric-btn req-btn">
        <div class="hm-glow"></div>
        <div class="hm-inner">
          <div class="hm-icon">📥</div>
          <div>
            <div class="hm-title">My Requests</div>
            <div class="hm-count" id="btn-count-req">0</div>
            <div class="hm-sub">View received items ↗</div>
          </div>
        </div>
      </div>
    </div>"""

if "class=\"history-metrics-container\"" not in content_prof:
    content_prof = content_prof.replace(target_prof, replacement_prof)
    with open('profile.html', 'w', encoding='utf-8') as f:
        f.write(content_prof)

# 3. Add CSS for these new classes to style.css
with open('css/style.css', 'r', encoding='utf-8') as f:
    content_css = f.read()

new_css = """
.history-metrics-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 20px; }
.history-metric-btn { padding: 20px; border-radius: 16px; cursor: pointer; position: relative; overflow: hidden; transition: all .3s ease; }
.history-metric-btn:hover { transform: translateY(-4px); }
.history-metric-btn.don-btn { background: linear-gradient(135deg, var(--t1), var(--g1)); color: #fff; box-shadow: 0 8px 24px rgba(13,148,136,0.25); }
.history-metric-btn.don-btn:hover { box-shadow: 0 12px 32px rgba(13,148,136,0.4); }
.history-metric-btn.req-btn { background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; box-shadow: 0 8px 24px rgba(59,130,246,0.25); }
.history-metric-btn.req-btn:hover { box-shadow: 0 12px 32px rgba(59,130,246,0.4); }
.hm-glow { position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; animation: pulseGlow 3s infinite; }
.hm-inner { display: flex; align-items: center; gap: 14px; position: relative; z-index: 1; }
.hm-icon { font-size: 2.8rem; }
.hm-title { font-size: .9rem; opacity: .9; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
.hm-count { font-size: 2.2rem; font-weight: 800; line-height: 1.1; }
.hm-sub { font-size: .8rem; opacity: .9; margin-top: 4px; }

@media(max-width:768px){
  .history-metrics-container { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .history-metric-btn { padding: 12px; }
  .hm-inner { gap: 8px; flex-direction: column; text-align: center; }
  .hm-icon { font-size: 2rem; margin-bottom: -5px; }
  .hm-title { font-size: .7rem; letter-spacing: 0; }
  .hm-count { font-size: 1.8rem; }
  .hm-sub { display: none; }
}
"""

if ".history-metrics-container" not in content_css:
    content_css += new_css
    with open('css/style.css', 'w', encoding='utf-8') as f:
        f.write(content_css)

print("Patched all fixes")
