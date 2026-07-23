import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '../store/AppContext';

export default function P2PChatModal({ partner, partnerRole, currentUser, currentUserRole, activity, onClose, db, syncDatabase }) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const messagesEndRef = useRef(null);

  // Filter messages between currentUser and partner
  const chatMessages = (db.messages || []).filter(
    (m) =>
      (m.sender_username === currentUser && m.receiver_username === partner) ||
      (m.sender_username === partner && m.receiver_username === currentUser)
  ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Full Sync polling similar to WhatsApp
  useEffect(() => {
    const interval = setInterval(() => {
      syncDatabase();
    }, 3000);
    return () => clearInterval(interval);
  }, [syncDatabase]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    setIsSending(true);
    
    const payload = {
      sender_username: currentUser,
      receiver_username: partner,
      message_text: input.trim(),
      context_type: 'p2p_chat'
    };

    try {
      const { error } = await supabaseClient.from('messages').insert([payload]);
      if (error) throw error;
      
      setInput('');
      await syncDatabase(); // Refresh messages immediately
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const myHandshake = chatMessages.some(m => m.sender_username === currentUser && m.context_type === 'handshake');
  const partnerHandshake = chatMessages.some(m => m.sender_username === partner && m.context_type === 'handshake');
  const isComplete = myHandshake && partnerHandshake;

  const handleHandshake = async () => {
    if (myHandshake || isSending) return;
    
    // Receiver confirmation prompt
    if (currentUserRole === 'receiver' || (activity && activity.type === 'Request')) {
      if (!window.confirm("Did you receive the donation?")) return;
    }
    
    setIsSending(true);
    
    try {
      const payload = {
        sender_username: currentUser,
        receiver_username: partner,
        message_text: `🤝 ${currentUser} has agreed to fulfill the transaction!`,
        context_type: 'handshake'
      };
      await supabaseClient.from('messages').insert([payload]);

      if (partnerHandshake) {
        // Both shook hands, complete the transaction
        const req = db.requests.find(r => 
          ((r.req_name || '').toLowerCase() === currentUser.toLowerCase() && (r.assigned_to || '').toLowerCase() === partner.toLowerCase()) || 
          ((r.req_name || '').toLowerCase() === partner.toLowerCase() && (r.assigned_to || '').toLowerCase() === currentUser.toLowerCase())
        );
        const don = db.donations.find(d => 
          ((d.donor_name || '').toLowerCase() === currentUser.toLowerCase() && (d.claimed_by || '').toLowerCase() === partner.toLowerCase()) || 
          ((d.donor_name || '').toLowerCase() === partner.toLowerCase() && (d.claimed_by || '').toLowerCase() === currentUser.toLowerCase())
        );

        if (req) await supabaseClient.from('requests').update({ status: 'completed' }).eq('id', req.id);
        
        if (don) {
          if (req && don.quantity > req.quantity) {
             const newQty = don.quantity - req.quantity;
             await supabaseClient.from('donations').update({ status: 'available', quantity: newQty, claimed_by: null }).eq('id', don.id);
          } else {
             await supabaseClient.from('donations').update({ status: 'completed' }).eq('id', don.id);
          }
        } else if (activity?.type === 'Donation') {
           await supabaseClient.from('donations').update({ status: 'completed' }).eq('id', activity.id);
        }

        // Delete all chat messages between these two users (chat cannot be reinitiated)
        const msgIds = chatMessages.map(m => m.id);
        if (msgIds.length > 0) {
           await supabaseClient.from('messages').delete().in('id', msgIds);
        }

        await syncDatabase();
        setTimeout(() => {
          alert('Transaction Completed & Chat Deleted!');
          onClose();
        }, 500);
        return; // exit early since onClose handles it
      }
      
      await syncDatabase();
    } catch (err) {
      console.error(err);
      alert('Handshake failed');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelTransaction = async () => {
    if (!cancelReason) return alert("Please select a reason for cancellation");
    setIsSending(true);
    try {
      const req = db.requests.find(r => 
        ((r.req_name || '').toLowerCase() === currentUser.toLowerCase() && (r.assigned_to || '').toLowerCase() === partner.toLowerCase()) || 
        ((r.req_name || '').toLowerCase() === partner.toLowerCase() && (r.assigned_to || '').toLowerCase() === currentUser.toLowerCase())
      );
      const don = db.donations.find(d => 
        ((d.donor_name || '').toLowerCase() === currentUser.toLowerCase() && (d.claimed_by || '').toLowerCase() === partner.toLowerCase()) || 
        ((d.donor_name || '').toLowerCase() === partner.toLowerCase() && (d.claimed_by || '').toLowerCase() === currentUser.toLowerCase())
      );

      if (req) await supabaseClient.from('requests').update({ status: 'pending', assigned_to: null }).eq('id', req.id);
      if (don) await supabaseClient.from('donations').update({ status: 'available', claimed_by: null }).eq('id', don.id);
      
      const msgIds = chatMessages.map(m => m.id);
      if (msgIds.length > 0) {
         await supabaseClient.from('messages').delete().in('id', msgIds);
      }

      const notifUser = partnerRole === 'donor' ? don?.donor_username : (partnerRole === 'receiver' ? req?.req_username : partner);
      if (notifUser) {
        await supabaseClient.from('notifications').insert([{
          user_username: notifUser,
          message: `⚠️ Transaction canceled by ${currentUser}. Reason: ${cancelReason}`,
          urgency: 'High'
        }]);
      }

      await syncDatabase();
      alert("Transaction successfully canceled. The item is back in the public feed.");
      onClose();
    } catch(err) {
      console.error(err);
      alert("Failed to cancel transaction.");
      setIsSending(false);
    }
  };


  // Determine dot color based on role
  const getDotColor = (role) => {
    if (role === 'donor') return '#10b981'; // Green
    if (role === 'volunteer') return '#fb923c'; // Orange
    if (role === 'receiver') return '#3b82f6'; // Blue
    return '#94a3b8'; // Default Gray
  };

  const partnerColor = getDotColor(partnerRole);
  const myColor = getDotColor(currentUserRole || 'donor');

  return (
    <div className="modal-bg" style={{ zIndex: 3000 }}>
      <div className="modal-box" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '500px' }}>
        
        {/* Header */}
        <div className="chat-head" style={{ padding: '16px 20px', background: 'var(--card)', borderBottom: '1px solid var(--border)', color: 'var(--txt)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: partnerColor, boxShadow: `0 0 8px ${partnerColor}` }}></div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--g1)' }}>{partner}</h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--txt1)', textTransform: 'capitalize' }}>{partnerRole}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activity && activity.status !== 'completed' && !isComplete && (
              <>
                <button 
                  className="btn btn-sm" 
                  style={{ background: '#fee2e2', color: '#dc2626', border: 'none', opacity: isSending ? 0.7 : 1 }}
                  onClick={() => setShowCancelPrompt(!showCancelPrompt)}
                  disabled={isSending}
                >
                  🚫 Cancel
                </button>
                <button 
                  className="btn btn-sm" 
                  style={{ 
                    background: myHandshake ? 'var(--bg)' : 'var(--p1)', 
                    color: myHandshake ? 'var(--txt1)' : '#fff', 
                    border: myHandshake ? '1px solid var(--border)' : 'none',
                    opacity: isSending ? 0.7 : 1
                  }}
                  onClick={handleHandshake}
                  disabled={myHandshake || isSending}
                >
                  {myHandshake ? '🤝 Waiting...' : '🤝 Agree to Fulfill'}
                </button>
              </>
            )}
            {(isComplete || (activity && activity.status === 'completed')) && (
               <span className="badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #10b981' }}>✅ Completed</span>
            )}
            <button className="x-btn" onClick={onClose} style={{ background: 'var(--g5)', color: 'var(--txt)' }}>✕</button>
          </div>
        </div>

        {/* Cancel Prompt Dropdown */}
        {showCancelPrompt && (
          <div style={{ background: '#fee2e2', padding: '15px 20px', borderBottom: '1px solid #fca5a5', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontWeight: 600, color: '#991b1b', fontSize: '0.9rem' }}>⚠️ Cancel Transaction? This cannot be undone.</div>
            <select 
              value={cancelReason} 
              onChange={(e) => setCancelReason(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #fca5a5', outline: 'none', fontSize: '0.9rem' }}
            >
              <option value="">-- Select a Reason --</option>
              <option value="Partner is unresponsive">Partner is unresponsive</option>
              <option value="Location is too far / Inconvenient">Location is too far / Inconvenient</option>
              <option value="Item is no longer available / spoiled">Item is no longer available / spoiled</option>
              <option value="Changed my mind / Error">Changed my mind / Error</option>
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-sm btn-outline" onClick={() => setShowCancelPrompt(false)}>Keep Chatting</button>
              <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff' }} onClick={handleCancelTransaction} disabled={isSending || !cancelReason}>
                {isSending ? 'Canceling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="chat-msgs" style={{ flex: 1, background: 'var(--bg)', padding: '20px' }}>
          {chatMessages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--txt1)', marginTop: '20px' }}>
              No messages yet. Say hello! 👋
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isMine = msg.sender_username === currentUser;
              const msgColor = isMine ? myColor : partnerColor;
              
              return (
                <div key={msg.id} className={`chat-msg ${isMine ? 'user' : 'bot'}`} style={{ 
                  background: msg.context_type === 'handshake' ? '#fef3c7' : (isMine ? `linear-gradient(135deg, ${msgColor}, ${msgColor}cc)` : 'var(--card)'),
                  color: msg.context_type === 'handshake' ? '#d97706' : (isMine ? '#fff' : 'var(--txt)'),
                  border: msg.context_type === 'handshake' ? '1px solid #fcd34d' : (isMine ? 'none' : `1px solid ${partnerColor}40`),
                  position: 'relative',
                  fontWeight: msg.context_type === 'handshake' ? 'bold' : 'normal',
                  textAlign: msg.context_type === 'handshake' ? 'center' : 'left',
                  alignSelf: msg.context_type === 'handshake' ? 'center' : (isMine ? 'flex-end' : 'flex-start')
                }}>
                  {!isMine && msg.context_type !== 'handshake' && (
                    <div style={{ position: 'absolute', top: '10px', left: '-6px', width: '8px', height: '8px', borderRadius: '50%', background: partnerColor }}></div>
                  )}
                  {msg.message_text}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Row */}
        <div className="chat-input-row" style={{ background: 'var(--card)' }}>
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isSending}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', border: '1px solid var(--border)' }}
          />
          <button 
            className="chat-send" 
            onClick={handleSend} 
            disabled={isSending}
            style={{ opacity: isSending ? 0.5 : 1 }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
