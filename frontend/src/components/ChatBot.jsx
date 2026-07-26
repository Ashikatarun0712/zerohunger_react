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
  const { lang } = useTranslation();

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
    let reply = `[${lang.toUpperCase()}] Oh no, it looks like my AI cloud brain is currently taking a little nap! 💤 But don't worry, I'm still here in offline mode to help you out! You can ask me how to donate, volunteer, or request food. How can I brighten your day? ✨`;
    const lower = userText.toLowerCase();
    
    // Check specific statistics queries first
    if (lower.includes('live') && lower.includes('donation')) {
      const availCount = db.donations ? db.donations.filter(d => d.status === 'available').length : 0;
      reply = `[${lang.toUpperCase()}] Awesome! 🎉 Right now, we have **${availCount}** live, delicious food donations waiting to be claimed. 🍲 Head over to the 'Receiver Module' to see what's on the menu today!`;
    } else if (lower.includes('urgent') && lower.includes('request')) {
      const urgentCount = db.requests ? db.requests.filter(r => r.urgency && (r.urgency.toLowerCase() === 'high' || r.urgency.toLowerCase().includes('urgent'))).length : 0;
      reply = `[${lang.toUpperCase()}] 🚨 This is super important! We currently have **${urgentCount}** urgent requests for food. People in our community really need our help right now. If you have anything to share, please check the 'Donor Module' immediately. Thank you for your big heart! 💖`;
    } else if ((lower.includes('number of') || lower.includes('total')) && lower.includes('request')) {
      const reqCount = db.requests ? db.requests.length : 0;
      reply = `[${lang.toUpperCase()}] We currently have **${reqCount}** food requests on the platform. Every single meal makes a difference, so let's try to fulfill as many as we can together! 🤝`;
    } else if (lower.includes('total completed') || lower.includes('completed donation') || lower.includes('meals saved')) {
      const totalCompleted = db.platform_stats ? db.platform_stats.total_meals_saved : 0;
      const totalDonations = db.platform_stats ? db.platform_stats.total_donations : 0;
      reply = `[${lang.toUpperCase()}] 🌟 Wow! Our amazing community has successfully processed **${totalDonations}** donations, which means we've saved and shared approximately **${totalCompleted}** meals! 🥳 Isn't that incredible? Thank you for being a part of this beautiful journey!`;
    } else if (lower.includes('mass') || lower.includes('campaign') || lower.includes('event')) {
      reply = `[${lang.toUpperCase()}] Planning a big event or a feast? 🎊 That's amazing! You can easily host a mass donation campaign. Just hop into the 'Donor Module' and click on the 'Mass Event' button at the top to organize bulk donations. Let's feed the crowds! 🚚`;
    } else if (lower.includes('leaderboard') || lower.includes('rank') || lower.includes('score') || lower.includes('points')) {
      reply = `[${lang.toUpperCase()}] 🏆 Ready for some friendly competition? The Leaderboard tracks your hero score! You earn points every time you donate, fulfill requests, or hit the road to volunteer. Go check the 'Leaderboard' tab and see how high you can climb! 🚀`;
    } else if (lower.includes('profile') || lower.includes('account')) {
      reply = `[${lang.toUpperCase()}] 👤 Your profile is your hero headquarters! You can view and edit your details, check out your awesome gamification stats, and see your personal history securely in the 'Profile' section.`;
    } else if (lower.includes('thank')) {
      reply = `[${lang.toUpperCase()}] You are so very welcome! 🥰 It's an absolute pleasure helping you. Let's keep working hand-in-hand to eliminate hunger in our beautiful community. You rock! 🙌`;
    } else if (lower.includes('how to volunteer') || lower.includes('become a volunteer')) {
      reply = `[${lang.toUpperCase()}] 🦸‍♀️🦸‍♂️ We would LOVE to have you as a volunteer! It's super easy. Just head to the 'Volunteer Module', select your shift and vehicle type (you can even sign up to walk as a micro-volunteer!), and start accepting nearby delivery jobs. Every delivery is a smile delivered! 🚲`;
    } else if (lower.includes('donate')) {
      reply = `[${lang.toUpperCase()}] 🎁 Donating is the most wonderful thing you can do today! Just go to the 'Donor Module' on your dashboard. Snap a quick, clear picture of the food, and our super-smart AI will automatically check its freshness and calculate the expiry date for you. It's like magic! ✨`;
    } else if (lower.includes('volunteer') || lower.includes('deliver')) {
      const volCount = db.volunteers ? db.volunteers.length : 0;
      reply = `[${lang.toUpperCase()}] 🚗 Micro-volunteering is the heartbeat of our platform! We are so proud to have **${volCount}** active volunteers right now. Jump into the 'Micro-Volunteer' tab to register your wheels (or your walking shoes!) and find jobs nearby.`;
    } else if (lower.includes('request') || lower.includes('receiver') || lower.includes('food')) {
      const availCount = db.donations ? db.donations.filter(d => d.status === 'available').length : 0;
      reply = `[${lang.toUpperCase()}] 🍽️ Hungry? We've got you covered! There are currently **${availCount}** active, delicious food donations ready to go. Visit the 'Receiver Module' right now to browse the map and claim what you need. Don't go hungry! 🥗`;
    } else if (lower.includes('trust') || lower.includes('ngo') || lower.includes('money') || lower.includes('fund')) {
      reply = `[${lang.toUpperCase()}] 🏛️ Are you part of an NGO or Trust? Welcome! You can request bulk food or even monetary funding here. Just upload your official NGO certificate in the 'Trust Portal'. Our AI will verify it instantly, and you'll be ready to publish fund requests in no time! 💰`;
    } else if (lower.includes('safety') || lower.includes('guidelines') || lower.includes('fresh')) {
      reply = `[${lang.toUpperCase()}] 🛡️ Food safety is our #1 priority! Here is the golden rule: Cooked food must be distributed within 24 hours. Raw produce is tougher and can last up to 20 days! For packaged food, always check the printed expiry. And don't worry, our AI is always here to double-check freshness for you! 🥦`;
    } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('morning') || lower.includes('evening')) {
      const availCount = db.donations ? db.donations.filter(d => d.status === 'available').length : 0;
      reply = `[${lang.toUpperCase()}] 👋 Hello there, superstar! I'm operating in offline fallback mode today, but I'm still full of energy and ready to help! Did you know there are **${availCount}** active food donations on the platform right now? Let's save some meals and spread some joy today! How can I assist you? ☀️`;
    } else if (lower.includes('sad') || lower.includes('hungry') || lower.includes('help')) {
      reply = `[${lang.toUpperCase()}] 🥺 Oh no, please don't be sad! We are here for you. Our community is full of people who care. Head straight to the 'Receiver Module' to see the food available nearby, or put out an urgent request. We will make sure you are taken care of! ❤️`;
    } else if (lower.includes('joke') || lower.includes('funny')) {
      reply = `[${lang.toUpperCase()}] 😂 Why did the tomato turn red? Because it saw the salad dressing! 🥗 I hope that brought a smile to your face! Now, how about we go share some food?`;
    }

    return { text: reply, actions: getSmartActions(userText + " " + reply) };
  };

  const sendMessageText = async (textToSubmit) => {
    if (!textToSubmit.trim()) return;
    const userText = textToSubmit.trim();
    
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

      const availCount = db.donations ? db.donations.filter(d => d.status === 'available').length : 0;
      const reqCount = db.requests ? db.requests.length : 0;
      const urgentCount = db.requests ? db.requests.filter(r => r.urgency && (r.urgency.toLowerCase() === 'high' || r.urgency.toLowerCase().includes('urgent'))).length : 0;
      const totalCompleted = db.platform_stats ? db.platform_stats.total_meals_saved : 0;
      const totalDonations = db.platform_stats ? db.platform_stats.total_donations : 0;

      const systemPrompt = `You are the ZeroHunger P2P platform AI assistant. Be helpful, concise, and friendly. Guide users on how to donate food, request food, or volunteer.
Current Platform Stats:
- Live/Available Donations: ${availCount}
- Total Requests: ${reqCount}
- Urgent Requests: ${urgentCount}
- Total Lifetime Donations: ${totalDonations}
- Total Meals Saved: ${totalCompleted}
IMPORTANT: You must reply entirely in the ISO language code: ${lang.toUpperCase()}. Do not use English unless the code is EN.`;

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
              content: systemPrompt
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

  const sendMessage = () => sendMessageText(input);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const pressTimer = useRef(null);
  const dragRef = useRef({ startX: 0, startY: 0, currentX: 0, currentY: 0 });

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    e.target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    
    // Save initial in case move clears it
    dragRef.current.startX = startX;
    dragRef.current.startY = startY;

    pressTimer.current = setTimeout(() => {
      setIsDragging(true);
      dragRef.current = { startX, startY, currentX: position.x, currentY: position.y };
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 2000);
  };

  const handlePointerMove = (e) => {
    if (!isDragging && pressTimer.current) {
      const dx = Math.abs(e.clientX - dragRef.current.startX);
      const dy = Math.abs(e.clientY - dragRef.current.startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    }

    if (isDragging) {
      e.preventDefault();
      const newX = dragRef.current.currentX + (e.clientX - dragRef.current.startX);
      const newY = dragRef.current.currentY + (e.clientY - dragRef.current.startY);
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e) => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    
    if (isDragging) {
      setIsDragging(false);
      dragRef.current.currentX = position.x;
      dragRef.current.currentY = position.y;
      e.target.releasePointerCapture(e.pointerId);
    } else {
      setIsOpen(true);
    }
  };

  return (
    <div className="chat-wrap" style={{ transform: isOpen ? 'none' : `translate(${position.x}px, ${position.y}px)`, touchAction: isDragging ? 'none' : 'auto', zIndex: isDragging ? 9999 : (isOpen ? 3000 : 500) }}>
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

        {/* Quick Replies Strip */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border)', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {["How to donate?", "View live requests", "How to volunteer?", "Leaderboard points", "Trust & NGO features", "Safety guidelines"].map((qr, idx) => (
            <button 
              key={idx} 
              className="btn btn-sm" 
              style={{ flexShrink: 0, borderRadius: '20px', background: 'rgba(255,255,255,0.1)', color: 'var(--txt)', border: '1px solid var(--border)', fontSize: '0.75rem', padding: '6px 12px' }}
              onClick={() => sendMessageText(qr)}
            >
              {qr}
            </button>
          ))}
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
        <button 
          className={`chat-toggle ${isDragging ? 'dragging' : ''}`} 
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ cursor: isDragging ? 'grabbing' : 'pointer', touchAction: 'none' }}
        >
          🤖
        </button>
      )}
    </div>
  );
}
