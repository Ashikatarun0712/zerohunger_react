import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Target 1: Inject isHandshakeComplete and notification panel variables
target1 = """    const confirmedByMe = isDonor ? req.donor_confirmed : req.receiver_confirmed;
    const confirmedByOther = isDonor ? req.receiver_confirmed : req.donor_confirmed;
    
    let handoffHtml = '';"""

replacement1 = """    const confirmedByMe = isDonor ? req.donor_confirmed : req.receiver_confirmed;
    const confirmedByOther = isDonor ? req.receiver_confirmed : req.donor_confirmed;
    const isHandshakeComplete = (confirmedByMe && confirmedByOther) || ['done', 'completed', 'expired'].includes((don.status||'').toLowerCase());
    const createdTime = new Date(req.created_at || Date.now()).toLocaleDateString();
    
    const notificationPanelHtml = `
        <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:.8rem;">
            <div style="font-weight:700;color:var(--g1);margin-bottom:6px;display:flex;align-items:center;gap:6px">
                <span style="font-size:1.1rem">🔔</span> Security & Tracking Info
            </div>
            <ul style="margin:0;padding-left:20px;color:var(--txt2);font-size:.78rem;line-height:1.5">
                <li><strong style="color:var(--g2)">Status:</strong> ${isHandshakeComplete ? 'Handoff Completed ✅' : 'Handoff Pending ⏳'}</li>
                <li><strong style="color:var(--g2)">Match Date:</strong> ${createdTime}</li>
            </ul>
            <div style="margin-top:8px;padding:8px 10px;background:#fff1f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-weight:600;display:flex;gap:6px;align-items:flex-start">
                <span>⚠️</span> 
                <span>Never share sensitive banking details (UPI, Card, CVV) outside the verified Trust Fund modules. This chat is for coordination only.</span>
            </div>
        </div>
    `;

    let chatInputHtml = '';
    if (isHandshakeComplete) {
        chatInputHtml = `
            <div style="padding:14px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;color:#475569;font-weight:600;font-size:.85rem;display:flex;align-items:center;justify-content:center;gap:8px">
                <span style="font-size:1.1rem">🔒</span> 
                Chat is securely locked. The handoff has been completed.
            </div>
        `;
    } else {
        chatInputHtml = `
            <div style="padding:12px 14px;border-top:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;background:#fafafa">
                <input type="text" id="p2p-chat-input" placeholder="Type a message..." style="flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:20px;outline:none;font-size:.85rem;background:#fff;transition:border .2s" onfocus="this.style.border='1.5px solid #10b981'" onblur="this.style.border='1.5px solid #e2e8f0'">
                <button style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:10px 18px;border-radius:20px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.3);transition:transform .15s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="sendP2PMessage(${donationId}, '${otherUser}', ${isDonor})">Send ↗</button>
            </div>
        `;
    }
    
    let handoffHtml = '';"""

content = content.replace(target1, replacement1)

# Target 2: Inject notification panel into showModal call
target2 = """        <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:.85rem;color:var(--txt2);display:flex;justify-content:space-between;align-items:center">
            <span>Coordinating with: <strong>${esc(isDonor ? req.req_name : don.donor_name)}</strong></span>
            <span style="background:#dbeafe;color:#1e40af;padding:3px 10px;border-radius:99px;font-size:.75rem;font-weight:600">${esc(don.food_name)} · ${req.quantity} units</span>
        </div>
        ${handoffHtml}
        <div id="chat-msgs-container\""""

replacement2 = """        <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:.85rem;color:var(--txt2);display:flex;justify-content:space-between;align-items:center">
            <span>Coordinating with: <strong>${esc(isDonor ? req.req_name : don.donor_name)}</strong></span>
            <span style="background:#dbeafe;color:#1e40af;padding:3px 10px;border-radius:99px;font-size:.75rem;font-weight:600">${esc(don.food_name)} · ${req.quantity} units</span>
        </div>
        ${notificationPanelHtml}
        ${handoffHtml}
        <div id="chat-msgs-container\""""

content = content.replace(target2, replacement2)

# Target 3: Replace chat input html
target3 = """        </div>
        <div style="padding:12px 14px;border-top:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;background:#fafafa">
            <input type="text" id="p2p-chat-input" placeholder="Type a message..." style="flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:20px;outline:none;font-size:.85rem;background:#fff;transition:border .2s" onfocus="this.style.border='1.5px solid #10b981'" onblur="this.style.border='1.5px solid #e2e8f0'">
            <button style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:10px 18px;border-radius:20px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.3);transition:transform .15s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="sendP2PMessage(${donationId}, '${otherUser}', ${isDonor})">Send ↗</button>
        </div>
    `);"""

replacement3 = """        </div>
        ${chatInputHtml}
    `);"""

content = content.replace(target3, replacement3)

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched app.js with chat security features!")
