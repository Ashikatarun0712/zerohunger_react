import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '../store/AppContext';

export default function P2PChatModal({ partner, partnerRole, currentUser, onClose, db, syncDatabase }) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
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

  // Determine dot color based on role
  const getDotColor = (role) => {
    if (role === 'donor') return '#10b981'; // Green
    if (role === 'volunteer') return '#fb923c'; // Orange
    if (role === 'receiver') return '#3b82f6'; // Blue
    return '#94a3b8'; // Default Gray
  };

  const partnerColor = getDotColor(partnerRole);
  const myColor = getDotColor(currentUser.role || 'donor'); // Assuming default if unknown

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
          <button className="x-btn" onClick={onClose} style={{ background: 'var(--g5)', color: 'var(--txt)' }}>✕</button>
        </div>

        {/* Messages */}
        <div className="chat-msgs" style={{ flex: 1, background: 'var(--bg)', padding: '20px' }}>
          {chatMessages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--txt1)', marginTop: '20px' }}>
              No messages yet. Say hello! 👋
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isMine = msg.sender_username === currentUser;
              const msgColor = isMine ? '#10b981' : partnerColor; // Using green for my messages, or we could use my actual role color
              
              return (
                <div key={msg.id} className={`chat-msg ${isMine ? 'user' : 'bot'}`} style={{ 
                  background: isMine ? 'linear-gradient(135deg, var(--g2), var(--t1))' : 'var(--card)',
                  color: isMine ? '#fff' : 'var(--txt)',
                  border: isMine ? 'none' : `1px solid ${partnerColor}40`, // slight tint border
                  position: 'relative'
                }}>
                  {/* Subtle color dot indicator on the message bubble */}
                  {!isMine && (
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
