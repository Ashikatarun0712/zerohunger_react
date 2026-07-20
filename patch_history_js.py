import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject DOMContentLoaded routing
target_routing = """    } else if(currentPath === 'activity.html'){
        renderMyActivity();
    } else if(currentPath === 'admin.html'){"""

replacement_routing = """    } else if(currentPath === 'activity.html'){
        renderMyActivity();
    } else if(currentPath === 'history_donations.html'){
        renderMyDonationHistory();
    } else if(currentPath === 'history_requests.html'){
        renderMyRequestHistory();
    } else if(currentPath === 'profile.html' || currentPath === 'index.html'){
        updateProfileHistoryCounts();
    } else if(currentPath === 'admin.html'){"""

if "updateProfileHistoryCounts" not in content:
    content = content.replace(target_routing, replacement_routing)

# 2. Add functions
history_funcs = """
function updateProfileHistoryCounts() {
    const uStr = String(APP.user||'').toLowerCase().trim();
    const myDons = DB.donations.filter(d => String(d.donor_username||'').toLowerCase().trim() === uStr || String(d.donor_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim());
    const myReqs = DB.requests.filter(r => String(r.req_username||'').toLowerCase().trim() === uStr || String(r.req_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim());
    
    const donCountEl = document.getElementById('btn-count-don');
    if(donCountEl) donCountEl.textContent = myDons.length;
    
    const reqCountEl = document.getElementById('btn-count-req');
    if(reqCountEl) reqCountEl.textContent = myReqs.length;
}

function renderMyDonationHistory() {
    const tb = document.getElementById('my-history-don-tbody');
    if (!tb) return;
    const uStr = String(APP.user||'').toLowerCase().trim();
    const myDons = DB.donations.filter(d => String(d.donor_username||'').toLowerCase().trim() === uStr || String(d.donor_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim());
    
    const sorted = [...myDons].sort((a,b) => {
        const aEnds = ['done','completed','expired'].includes((a.status||'').toLowerCase());
        const bEnds = ['done','completed','expired'].includes((b.status||'').toLowerCase());
        if(aEnds && !bEnds) return 1;
        if(!aEnds && bEnds) return -1;
        return new Date(b.created_at||0) - new Date(a.created_at||0);
    });
    
    tb.innerHTML = sorted.length ? sorted.map(d => {
        let action = `<button class="btn btn-sm btn-outline" style="border-radius:4px;padding:4px 8px;font-size:.7rem" onclick="openConnectModal(${d.id})">View Chat</button>`;
        if(d.status === 'available') action = `<span style="font-size:.75rem;color:var(--txt3)">Waiting...</span>`;
        return `<tr>
            <td><span class="badge bg-b">Donor</span></td>
            <td><strong>${esc(d.food_name)}</strong></td>
            <td>${d.quantity}</td>
            <td><span class="badge ${sBadge(d.status)}">${d.status}</span></td>
            <td>Community</td>
            <td>${action}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="6" class="empty">You have not donated anything yet.</td></tr>`;
    
    // Render Chart
    const ctx = document.getElementById('donHistoryChart');
    if (ctx && window.Chart) {
        const statusCounts = { available:0, requested:0, assigned:0, done:0, expired:0, other:0 };
        myDons.forEach(d => {
            const s = (d.status||'').toLowerCase();
            if (statusCounts[s] !== undefined) statusCounts[s]++;
            else if(s==='completed') statusCounts.done++;
            else statusCounts.other++;
        });
        
        if(window.donChartInstance) window.donChartInstance.destroy();
        window.donChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Available', 'Requested', 'Assigned', 'Done/Completed', 'Expired', 'Other'],
                datasets: [{
                    label: 'My Donations',
                    data: [statusCounts.available, statusCounts.requested, statusCounts.assigned, statusCounts.done, statusCounts.expired, statusCounts.other],
                    backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#14b8a6', '#ef4444', '#94a3b8'],
                    borderRadius: 6
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }
}

function renderMyRequestHistory() {
    const tb = document.getElementById('my-history-req-tbody');
    if (!tb) return;
    const uStr = String(APP.user||'').toLowerCase().trim();
    const myReqs = DB.requests.filter(r => String(r.req_username||'').toLowerCase().trim() === uStr || String(r.req_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim());
    
    const sorted = [...myReqs].sort((a,b) => {
        const aEnds = ['done','completed','cancelled'].includes((a.status||'').toLowerCase());
        const bEnds = ['done','completed','cancelled'].includes((b.status||'').toLowerCase());
        if(aEnds && !bEnds) return 1;
        if(!aEnds && bEnds) return -1;
        return new Date(b.created_at||0) - new Date(a.created_at||0);
    });
    
    tb.innerHTML = sorted.length ? sorted.map(r => {
        let action = `<button class="btn btn-sm btn-outline" style="border-radius:4px;padding:4px 8px;font-size:.7rem" onclick="openConnectModal(${r.donation_id})">View Chat</button>`;
        return `<tr>
            <td><span class="badge bg-y">Receiver</span></td>
            <td><strong>${esc(r.food_name)}</strong></td>
            <td>${r.quantity}</td>
            <td><span class="badge ${sBadge(r.status)}">${r.status}</span></td>
            <td>Community</td>
            <td>${action}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="6" class="empty">You have not made any requests yet.</td></tr>`;
    
    // Render Chart
    const ctx = document.getElementById('reqHistoryChart');
    if (ctx && window.Chart) {
        const statusCounts = { pending:0, assigned:0, done:0, cancelled:0, other:0 };
        myReqs.forEach(r => {
            const s = (r.status||'').toLowerCase();
            if (statusCounts[s] !== undefined) statusCounts[s]++;
            else if(s==='completed') statusCounts.done++;
            else statusCounts.other++;
        });
        
        if(window.reqChartInstance) window.reqChartInstance.destroy();
        window.reqChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Pending', 'Assigned/Delivery', 'Done/Completed', 'Cancelled', 'Other'],
                datasets: [{
                    data: [statusCounts.pending, statusCounts.assigned, statusCounts.done, statusCounts.cancelled, statusCounts.other],
                    backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#94a3b8']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }
}
"""

if "function renderMyDonationHistory" not in content:
    content += "\n" + history_funcs

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched app.js with history rendering functions.")
