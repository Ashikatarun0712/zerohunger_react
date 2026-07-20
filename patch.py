import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Patch updateProfileCert
cert_target = """  setTxt('cert-donations',donCount);
  setTxt('cert-freshness',avgFresh);
  setTxt('cert-meals',meals);"""

cert_replacement = """  setTxt('cert-donations',donCount);
  setTxt('cert-freshness',avgFresh);
  setTxt('cert-meals',meals);
  
  const wastedCount = DB.donations.filter(d => (d.status || '').toLowerCase() === 'expired').length;
  const els = document.querySelectorAll('#cert-wasted');
  els.forEach(el => el.textContent = wastedCount);"""

content = content.replace(cert_target, cert_replacement)

# 2. Patch renderDonTbl
don_target = """  const uLat=APP.userLat||DEFAULT_LAT,uLng=APP.userLng||DEFAULT_LNG;
  tb.innerHTML=DB.donations.map(d=>{"""

don_replacement = """  const uLat=APP.userLat||DEFAULT_LAT,uLng=APP.userLng||DEFAULT_LNG;
  
  const sorted = [...DB.donations].sort((a,b)=>{
      const aDone = ['done', 'completed', 'expired'].includes((a.status||'').toLowerCase()) ? 1 : 0;
      const bDone = ['done', 'completed', 'expired'].includes((b.status||'').toLowerCase()) ? 1 : 0;
      return aDone - bDone;
  });
  
  tb.innerHTML=sorted.map(d=>{"""

content = content.replace(don_target, don_replacement)

# 3. Patch renderMyActivity
activity_target = """        let actBtn = '-';
        if (hasReq && ['requested', 'assigned', 'accepted'].includes(d.status.toLowerCase())) {
            actBtn = `<button class="btn btn-sm btn-primary" style="background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;font-weight:700;padding:6px 14px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.4);transition:transform .15s" onclick="openConnectModal(${d.id})"><i class='bx bx-message-rounded-dots'></i> Chat</button>`;
        } else if (d.status.toLowerCase() === 'done') {
            actBtn = `<span style="color:#16a34a;font-weight:600">✅ Completed</span>`;
        } else if (d.status.toLowerCase() === 'available') {
             actBtn = `<span style="color:#d97706;font-weight:600">⏳ Waiting</span>`;
        }
        
        rows.push(`<tr>
            <td><span class="badge" style="background:#e0e7ff;color:#4338ca">Donor</span></td>
            <td>${esc(d.food_name)}</td>
            <td>${d.quantity}</td>
            <td><span class="badge ${sBadge(d.status)}">${d.status}</span></td>
            <td>${esc(partner)}</td>
            <td>${actBtn}</td>
        </tr>`);
    });

    // Process Requests
    myRequests.forEach(r => {
        const don = DB.donations.find(d => Number(d.id) === Number(r.donation_id));
        const partner = don ? don.donor_name : 'Unknown';
        
        let actBtn = '-';
        if (r.status.toLowerCase() !== 'pending') {
            if (['assigned', 'accepted'].includes(r.status.toLowerCase()) || don?.status === 'requested') {
                 actBtn = `<button class="btn btn-sm btn-primary" style="background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;font-weight:700;padding:6px 14px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.4);transition:transform .15s" onclick="openConnectModal(${r.donation_id})"><i class='bx bx-message-rounded-dots'></i> Chat</button>`;
            } else if (r.status.toLowerCase() === 'done' || don?.status === 'done') {
                 actBtn = `<span style="color:#16a34a;font-weight:600">✅ Completed</span>`;
            }
        } else {
             actBtn = `<span style="color:#d97706;font-weight:600">⏳ Pending</span>`;
        }

        rows.push(`<tr>
            <td><span class="badge" style="background:#dcfce7;color:#166534">Receiver</span></td>
            <td>${esc(r.food_name)}</td>
            <td>${r.quantity}</td>
            <td><span class="badge ${sBadge(r.status)}">${r.status}</span></td>
            <td>${esc(partner)}</td>
            <td>${actBtn}</td>
        </tr>`);
    });

    if (rows.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="empty">No activity found.</td></tr>';
    } else {
        tb.innerHTML = rows.join('');
    }"""

activity_replacement = """        let actBtn = '-';
        if (hasReq && ['requested', 'assigned', 'accepted'].includes(d.status.toLowerCase())) {
            actBtn = `<button class="btn btn-sm btn-primary" style="background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;font-weight:700;padding:6px 14px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.4);transition:transform .15s" onclick="openConnectModal(${d.id})"><i class='bx bx-message-rounded-dots'></i> Chat</button>`;
        } else if (['done', 'completed', 'expired'].includes(d.status.toLowerCase())) {
            actBtn = `<span style="color:#16a34a;font-weight:600">✅ Completed</span>`;
        } else if (d.status.toLowerCase() === 'available') {
             actBtn = `<span style="color:#d97706;font-weight:600">⏳ Waiting</span>`;
        }
        
        rows.push({
            isDone: ['done', 'completed', 'expired'].includes((d.status||'').toLowerCase()),
            html: `<tr>
            <td><span class="badge" style="background:#e0e7ff;color:#4338ca">Donor</span></td>
            <td>${esc(d.food_name)}</td>
            <td>${d.quantity}</td>
            <td><span class="badge ${sBadge(d.status)}">${d.status}</span></td>
            <td>${esc(partner)}</td>
            <td>${actBtn}</td>
        </tr>`});
    });

    // Process Requests
    myRequests.forEach(r => {
        const don = DB.donations.find(d => Number(d.id) === Number(r.donation_id));
        const partner = don ? don.donor_name : 'Unknown';
        
        let actBtn = '-';
        if (r.status.toLowerCase() !== 'pending') {
            if (['assigned', 'accepted'].includes(r.status.toLowerCase()) || don?.status === 'requested') {
                 actBtn = `<button class="btn btn-sm btn-primary" style="background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;font-weight:700;padding:6px 14px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.4);transition:transform .15s" onclick="openConnectModal(${r.donation_id})"><i class='bx bx-message-rounded-dots'></i> Chat</button>`;
            } else if (['done', 'completed', 'expired'].includes(r.status.toLowerCase()) || ['done', 'completed', 'expired'].includes(don?.status?.toLowerCase())) {
                 actBtn = `<span style="color:#16a34a;font-weight:600">✅ Completed</span>`;
            }
        } else {
             actBtn = `<span style="color:#d97706;font-weight:600">⏳ Pending</span>`;
        }

        rows.push({
            isDone: ['done', 'completed', 'expired'].includes((r.status||'').toLowerCase()),
            html: `<tr>
            <td><span class="badge" style="background:#dcfce7;color:#166534">Receiver</span></td>
            <td>${esc(r.food_name)}</td>
            <td>${r.quantity}</td>
            <td><span class="badge ${sBadge(r.status)}">${r.status}</span></td>
            <td>${esc(partner)}</td>
            <td>${actBtn}</td>
        </tr>`});
    });

    rows.sort((a,b) => (a.isDone ? 1 : 0) - (b.isDone ? 1 : 0));

    if (rows.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="empty">No activity found.</td></tr>';
    } else {
        tb.innerHTML = rows.map(r => r.html).join('');
    }"""

content = content.replace(activity_target, activity_replacement)


# 4. Patch renderTrustFunds
trust_target = """    el.innerHTML = openFunds.map(f => {
        return `<tr>
            <td style="font-weight:600"><span style="font-size:1.1rem">🏛️</span> ${f.trust_name}</td>
            <td>${f.purpose}</td>
            <td style="font-weight:700;color:var(--g2)">₹${f.amount}</td>
            <td style="font-size:.8rem;color:var(--b1)">${f.upi_id}</td>
            <td>
                <button class="btn btn-sm btn-primary" style="background:#0ea5e9" onclick="generateUPIPayment('${f.upi_id}', '${f.trust_name}', '${f.amount}')">💳 Pay via UPI</button>
            </td>
        </tr>`;
    }).join('');"""

trust_replacement = """    el.innerHTML = openFunds.map(f => {
        const trust = DB.trusts.find(t => t.trust_username === f.trust_username) || {};
        const isVerified = trust.verification_status === 'verified';
        
        const upiDisplay = isVerified ? f.upi_id : `<span style="color:var(--r1)">🔒 Hidden (Unverified)</span>`;
        const actionBtn = isVerified 
            ? `<button class="btn btn-sm btn-primary" style="background:#0ea5e9" onclick="generateUPIPayment('${f.upi_id}', '${f.trust_name}', '${f.amount}')">💳 Pay via UPI</button>`
            : `<button class="btn btn-sm btn-ghost" disabled title="Payment Halted - Trust Certificate not verified yet.">⏳ Pending Verification</button>`;
            
        return `<tr>
            <td style="font-weight:600"><span style="font-size:1.1rem">🏛️</span> ${f.trust_name}</td>
            <td>${f.purpose}</td>
            <td style="font-weight:700;color:var(--g2)">₹${f.amount}</td>
            <td style="font-size:.8rem;color:var(--b1)">${upiDisplay}</td>
            <td>${actionBtn}</td>
        </tr>`;
    }).join('');"""

content = content.replace(trust_target, trust_replacement)

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched app.js successfully!")
