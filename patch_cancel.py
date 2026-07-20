import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_handoff = """    let handoffHtml = '';
    if (confirmedByMe && confirmedByOther) {
        handoffHtml = `<div style="padding:12px 16px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#166534;font-weight:700;text-align:center;border-bottom:1px solid #86efac;font-size:0.9rem;letter-spacing:.5px">✅ Handoff Successfully Completed! Thank you! 🙏</div>`;
    } else if (confirmedByMe) {
        handoffHtml = `<div style="padding:12px 16px;background:linear-gradient(135deg,#fef9c3,#fef08a);color:#854d0e;text-align:center;border-bottom:1px solid #fde047;font-size:0.85rem;font-weight:600">⏳ You confirmed! Waiting for ${isDonor ? 'receiver' : 'donor'} to also confirm...</div>`;
    } else {
        handoffHtml = `<div style="padding:10px 16px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-bottom:2px solid #86efac;display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div>
                <div style="font-size:.85rem;font-weight:700;color:#166534">🤝 Delivery Handshake</div>
                <div style="font-size:.78rem;color:#15803d">Did you ${isDonor ? '📦 deliver' : '✅ receive'} the food?</div>
            </div>
            <button style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:8px 18px;border-radius:20px;font-weight:700;font-size:.82rem;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,.4);transition:all .2s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="confirmHandoff(${req.id})">🤝 Confirm Handoff</button>
        </div>`;
    }"""

replacement_handoff = """    let handoffHtml = '';
    if (req.status === 'cancelled') {
        handoffHtml = `<div style="padding:12px 16px;background:linear-gradient(135deg,#fee2e2,#fecaca);color:#991b1b;font-weight:700;text-align:center;border-bottom:1px solid #fca5a5;font-size:0.9rem;letter-spacing:.5px">❌ This request was cancelled.</div>`;
    } else if (confirmedByMe && confirmedByOther) {
        handoffHtml = `<div style="padding:12px 16px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#166534;font-weight:700;text-align:center;border-bottom:1px solid #86efac;font-size:0.9rem;letter-spacing:.5px">✅ Handoff Successfully Completed! Thank you! 🙏</div>`;
    } else if (confirmedByMe) {
        handoffHtml = `<div style="padding:12px 16px;background:linear-gradient(135deg,#fef9c3,#fef08a);color:#854d0e;text-align:center;border-bottom:1px solid #fde047;font-size:0.85rem;font-weight:600">⏳ You confirmed! Waiting for ${isDonor ? 'receiver' : 'donor'} to also confirm...</div>`;
    } else {
        handoffHtml = `<div style="padding:10px 16px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-bottom:2px solid #86efac;display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div>
                <div style="font-size:.85rem;font-weight:700;color:#166534">🤝 Delivery Handshake</div>
                <div style="font-size:.78rem;color:#15803d">Did you ${isDonor ? '📦 deliver' : '✅ receive'} the food?</div>
            </div>
            <div style="display:flex;gap:8px;">
                <button style="background:transparent;color:#991b1b;border:1.5px solid #fca5a5;padding:8px 14px;border-radius:20px;font-weight:700;font-size:.82rem;cursor:pointer;transition:all .2s" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'" onclick="cancelRequest(${req.id}, ${donationId})">❌ Cancel</button>
                <button style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:8px 18px;border-radius:20px;font-weight:700;font-size:.82rem;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,.4);transition:all .2s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="confirmHandoff(${req.id})">🤝 Confirm</button>
            </div>
        </div>`;
    }"""

content = content.replace(target_handoff, replacement_handoff)


cancel_logic = """
async function cancelRequest(reqId, donId) {
    const reason = prompt("Please provide a valid explanation for cancelling this request:");
    if (!reason || !reason.trim()) {
        toast("Cancellation requires a valid reason.", "err");
        return;
    }
    try {
        if (supabaseClient) {
            // Update request
            await supabaseClient.from('requests').update({ status: 'cancelled' }).eq('id', reqId);
            // Revert donation to available
            await supabaseClient.from('donations').update({ status: 'available' }).eq('id', donId);
            // Log reason in messages
            const sysMsg = {
                sender_username: APP.user,
                context_id: donId,
                context_type: 'donation',
                message_text: `❌ Request Cancelled by ${APP.name || APP.user}. Reason: ${reason.trim()}`
            };
            await supabaseClient.from('messages').insert([sysMsg]);
            await syncDatabase();
            toast("Request cancelled and logged.", "ok");
            closeModal();
            renderDonTbl();
            renderMyActivity();
        }
    } catch (e) {
        console.error(e);
        toast("Error cancelling request", "err");
    }
}
"""

if "async function cancelRequest" not in content:
    content += "\n" + cancel_logic

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("cancelRequest successfully patched!")
