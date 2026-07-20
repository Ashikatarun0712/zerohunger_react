import re

with open('activity.html', 'r', encoding='utf-8') as f:
    template = f.read()

# Generate history_donations.html
don_html = template.replace('<div id="activity-page" class="page active">', '<div id="history-donations-page" class="page active">')
don_html = don_html.replace('<h2 class="sec-title" style="margin:0"><i class="bx bx-pulse" style="font-size: 1.5rem; vertical-align: middle;"></i> My Live Activity</h2>', '<h2 class="sec-title" style="margin:0">📜 My Donation History</h2>')
don_html = don_html.replace('<h3><i class=\'bx bx-list-ul\'></i> My Donations & Requests</h3>', '<h3>📜 Foods I Have Donated</h3>')
don_html = don_html.replace('onclick="syncDatabase().then(()=>renderMyActivity())', 'onclick="syncDatabase().then(()=>renderMyDonationHistory())')
don_html = don_html.replace('<tbody id="my-activity-tbody">', '<tbody id="my-history-don-tbody">')

# Add the chart and motivational banner before the table card
banner_chart_don = """
    <!-- Motivational Banner -->
    <div style="background:linear-gradient(135deg,var(--t1),var(--g1));color:#fff;padding:24px;border-radius:16px;margin-top:20px;text-align:center;box-shadow:0 8px 24px rgba(13,148,136,0.3)">
      <div style="font-size:3rem;margin-bottom:10px">🌟</div>
      <h3 style="font-size:1.4rem;font-weight:800;margin-bottom:8px">You are a Hunger Hero!</h3>
      <p style="font-size:1rem;opacity:.9;max-width:600px;margin:0 auto">Your donations are changing lives. Every meal you share brings hope and health to someone in need. Let's keep the momentum going — your next donation could feed a whole family!</p>
      <button class="btn btn-outline" style="background:#fff;color:var(--t1);border:none;margin-top:16px;font-weight:700;padding:10px 24px" onclick="window.location.href='donor.html'">🎁 Donate Again Now</button>
    </div>
    
    <!-- Chart Card -->
    <div class="card" style="margin-top:20px">
      <div class="card-head"><h3>📊 Donation Analytics</h3></div>
      <div class="card-body">
        <canvas id="donHistoryChart" height="100"></canvas>
      </div>
    </div>
"""

don_html = don_html.replace('<div class="card" style="margin-top:20px">', banner_chart_don + '\n    <div class="card" style="margin-top:20px">', 1)

with open('history_donations.html', 'w', encoding='utf-8') as f:
    f.write(don_html)
print("Created history_donations.html")

# Generate history_requests.html
req_html = template.replace('<div id="activity-page" class="page active">', '<div id="history-requests-page" class="page active">')
req_html = req_html.replace('<h2 class="sec-title" style="margin:0"><i class="bx bx-pulse" style="font-size: 1.5rem; vertical-align: middle;"></i> My Live Activity</h2>', '<h2 class="sec-title" style="margin:0">📥 My Received History</h2>')
req_html = req_html.replace('<h3><i class=\'bx bx-list-ul\'></i> My Donations & Requests</h3>', '<h3>📥 Foods I Have Received</h3>')
req_html = req_html.replace('onclick="syncDatabase().then(()=>renderMyActivity())', 'onclick="syncDatabase().then(()=>renderMyRequestHistory())')
req_html = req_html.replace('<tbody id="my-activity-tbody">', '<tbody id="my-history-req-tbody">')

# Add the chart before the table card
banner_chart_req = """
    <!-- Chart Card -->
    <div class="card" style="margin-top:20px">
      <div class="card-head"><h3>📊 Requests Analytics</h3></div>
      <div class="card-body">
        <canvas id="reqHistoryChart" height="100"></canvas>
      </div>
    </div>
"""
req_html = req_html.replace('<div class="card" style="margin-top:20px">', banner_chart_req + '\n    <div class="card" style="margin-top:20px">', 1)

with open('history_requests.html', 'w', encoding='utf-8') as f:
    f.write(req_html)
print("Created history_requests.html")
