import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { useTranslation } from '../store/LanguageContext';
import { OPENROUTER_API_KEYS } from '../utils/api_keys';

let openRouterKeyIndex = 0;

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: 'Hi! I am the ZeroHunger AI assistant. I can help you figure out how to donate, check volunteer slots, or learn about food safety guidelines. How can I help today?', actions: [] }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [msgs, isTyping, isOpen]);

  const navigate = useNavigate();
  const { db } = useAppContext();
  const { lang, t } = useTranslation();

  const handleActionClick = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const getSmartActions = (text) => {
    const lower = text.toLowerCase();
    const actions = [];
    if (lower.includes('donate') || lower.includes('donor')) {
      actions.push({ label: '🎁 Go to Donor Module', path: '/donor' });
    }
    if (lower.includes('request') || lower.includes('receiver') || lower.includes('food')) {
      actions.push({ label: '📦 View Live Donations', path: '/request' });
    }
    if (lower.includes('volunteer') || lower.includes('deliver')) {
      actions.push({ label: '🚗 Volunteer Dashboard', path: '/volunteer' });
    }
    if (lower.includes('trust') || lower.includes('ngo')) {
      actions.push({ label: '🏛️ Trust Portal', path: '/trust' });
    }
    if (lower.includes('activity') || lower.includes('history')) {
      actions.push({ label: '📈 My Activity', path: '/activity' });
    }
    // Deduplicate actions by path
    const unique = [];
    actions.forEach(a => { if (!unique.some(u => u.path === a.path)) unique.push(a); });
    return unique.slice(0, 2); // Max 2 buttons per message to prevent clutter
  };

  const handleLocalFallback = (userText) => {
    let reply = `[${lang.toUpperCase()}] Offline: I am currently offline. You can ask me how to donate, volunteer, or request food!`;
    const lower = userText.toLowerCase();
    
    if (lower.includes('donate')) {
      reply = `[${lang.toUpperCase()}] To donate: Go to the 'Donor Module' on your dashboard. Take a clear picture of the food, and our AI will automatically assess its freshness and calculate the expiry date.`;
    } else if (lower.includes('volunteer') || lower.includes('deliver')) {
      const volCount = db.volunteers ? db.volunteers.length : 0;
      reply = `[${lang.toUpperCase()}] Micro-volunteering is easy! We currently have ${volCount} active volunteers. Go to the 'Micro-Volunteer' tab to register your vehicle.`;
    } else if (lower.includes('request') || lower.includes('receiver') || lower.includes('food')) {
      const availCount = db.donations ? db.donations.filter(d => d.status === 'available').length : 0;
      reply = `[${lang.toUpperCase()}] There are currently ${availCount} active food donations available right now! Visit the 'Receiver Module'.`;
    } else if (lower.includes('trust') || lower.includes('ngo')) {
      reply = `[${lang.toUpperCase()}] Trusts can request bulk food or monetary funding. Just upload your NGO certificate in the Trust portal, and our system will verify it instantly!`;
    } else if (lower.includes('hello') || lower.includes('hi')) {
      const availCount = db.donations ? db.donations.filter(d => d.status === 'available').length : 0;
      reply = `[${lang.toUpperCase()}] Hello there! I'm operating in offline fallback mode right now. Did you know there are ${availCount} active food donations on the platform today? Let's save some meals! What do you need?`;
    } else if (lower.includes('safety') || lower.includes('guidelines')) {
      reply = `[${lang.toUpperCase()}] Food safety is our priority! Cooked food must be distributed within 24 hours. Raw produce can last up to 20 days. Packaged food relies on the printed expiry.`;
    }

    return { text: reply, actions: getSmartActions(userText + " " + reply) };
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userText = input.trim();
    
    const newMsgs = [...msgs, { role: 'user', text: userText }];
    setMsgs(newMsgs);
    setInput('');
    setIsTyping(true);

    try {
      const apiKey = OPENROUTER_API_KEYS[openRouterKeyIndex % OPENROUTER_API_KEYS.length];
      openRouterKeyIndex++;

      const history = newMsgs.slice(-5).map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text
      }));

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'stepfun/step-1v-8k',
          messages: [
            {
              role: 'system',
              content: `You are the ZeroHunger P2P platform AI assistant. Be helpful, concise, and friendly. Guide users on how to donate food, request food, or volunteer. IMPORTANT: You must reply entirely in the ISO language code: ${lang.toUpperCase()}. Do not use English unless the code is EN.`
            },
            ...history
          ]
        })
      });

      if (!response.ok) throw new Error('API Rate limit or network error');

      const data = await response.json();
      const replyText = data.choices?.[0]?.message?.content;
      
      if (!replyText) throw new Error('Empty response');

      const actions = getSmartActions(replyText);
      setMsgs(prev => [...prev, { role: 'bot', text: replyText, actions }]);
    } catch (err) {
      console.warn("Live AI failed, falling back to local logic:", err);
      const fallbackPayload = handleLocalFallback(userText);
      setMsgs(prev => [...prev, { role: 'bot', text: fallbackPayload.text, actions: fallbackPayload.actions }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chat-wrap">
      <div className={`chat-box ${isOpen ? 'open' : ''}`}>
        <div className="chat-head">
          <h4>🤖 ZeroHunger Assistant</h4>
          <button className="x-btn" onClick={() => setIsOpen(false)} style={{ background: 'transparent', color: '#fff', fontSize: '1.2rem' }}>×</button>
        </div>
        <div className="chat-msgs">
          {msgs.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>{m.text}</div>
              {m.actions && m.actions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {m.actions.map((act, actIdx) => (
                    <button 
                      key={actIdx} 
                      className="btn btn-sm" 
                      onClick={() => handleActionClick(act.path)}
                      style={{ 
                        background: 'rgba(255,255,255,0.9)', 
                        color: 'var(--g1)', 
                        border: '1px solid var(--g3)', 
                        fontSize: '.75rem', 
                        padding: '4px 10px' 
                      }}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isTyping && <div className="chat-msg bot">...</div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-row">
          <input 
            type="text" 
            placeholder="Ask me anything..." 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button className="chat-send" onClick={sendMessage}>➤</button>
        </div>
      </div>
      {!isOpen && (
        <button className="chat-toggle" onClick={() => setIsOpen(true)}>🤖</button>
      )}
    </div>
  );
}
