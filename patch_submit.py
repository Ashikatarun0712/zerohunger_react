import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Patch 1: Block self repurchase and fix donation split in submitRequest
target_submit_req = """  if(!req_loc){toast('Enter your location','err');return}
  const pri=priorityScore(urg,don.expiry_days,don.freshness_score);const dist=getDonationDistance(don);
  const req={req_username: APP.user, req_name,donation_id:donId,food_name:don.food_name,quantity:qty,urgency:urg,location_label:req_loc,priority_score:pri,distance_km:dist.toFixed(2),status:'pending'};
  try {
      // --- GOOGLE SHEETS BACKEND (Temporarily Muted) ---
      /*
      await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'requests', payload: req }) });
      await syncDatabase();
      */
      
      // --- SUPABASE BACKEND ---
      if (supabaseClient) {
          const { error } = await supabaseClient.from('requests').insert([req]);
          if (error) throw error;
          await supabaseClient.from('donations').update({ status: 'requested' }).eq('id', req.donation_id);
          await syncDatabase();
      }
  } catch(e) { toast('Error: ' + (e.message||'Failed to save'), 'err'); return; }"""

replacement_submit_req = """  if(!req_loc){toast('Enter your location','err');return}
  if ((String(don.donor_username||'').toLowerCase().trim() === String(APP.user||'').toLowerCase().trim()) || (String(don.donor_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim())) {
      toast('You cannot request your own donation!', 'err'); return;
  }
  const pri=priorityScore(urg,don.expiry_days,don.freshness_score);const dist=getDonationDistance(don);
  const req={req_username: APP.user, req_name,donation_id:donId,food_name:don.food_name,quantity:qty,urgency:urg,location_label:req_loc,priority_score:pri,distance_km:dist.toFixed(2),status:'pending'};
  try {
      // --- SUPABASE BACKEND ---
      if (supabaseClient) {
          const { error } = await supabaseClient.from('requests').insert([req]);
          if (error) throw error;
          
          const originalDonQty = parseInt(don.quantity||"0");
          if (qty < originalDonQty) {
              const remainingQty = originalDonQty - qty;
              const newDon = {...don};
              delete newDon.id;
              newDon.quantity = remainingQty.toString();
              newDon.status = 'available';
              await supabaseClient.from('donations').insert([newDon]);
              await supabaseClient.from('donations').update({ status: 'requested', quantity: qty.toString() }).eq('id', req.donation_id);
          } else {
              await supabaseClient.from('donations').update({ status: 'requested' }).eq('id', req.donation_id);
          }
          await syncDatabase();
      }
  } catch(e) { toast('Error: ' + (e.message||'Failed to save'), 'err'); return; }"""

content = content.replace(target_submit_req, replacement_submit_req)

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("submitRequest successfully patched!")
