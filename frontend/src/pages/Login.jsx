import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';

export default function Login() {
  const { updateApp } = useAppContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState('signin');
  const [error, setError] = useState('');
  
  // Admin Popup State
  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');
  const [adminErr, setAdminErr] = useState('');
  const [showAdminPwd, setShowAdminPwd] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const un = e.target.username.value.trim().toLowerCase();
    const pw = e.target.password.value.trim();
    
    if (un === 'admin' && pw === 'assara') {
      updateApp({ user: 'admin', role: 'admin', name: 'System Administrator', prevPage: 'admin', emoji: '⚙️' });
      navigate('/admin');
      return;
    }

    try {
      const { data, error: dbError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('username', un)
        .eq('password', pw)
        .single();
        
      if (dbError || !data) {
        setError('Invalid credentials');
      } else {
        updateApp({ user: data.username, role: data.role, name: data.name, prevPage: 'profile', emoji: data.emoji || '👤' });
        navigate('/profile');
      }
    } catch {
      setError('Connection error');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const un = e.target.username.value.trim().toLowerCase();
    const pw = e.target.password.value;
    const name = e.target.name.value.trim();
    const email = e.target.email.value.trim();
    const role = e.target.role.value;
    const emoji = role === 'admin' ? '⚙️' : '👤';

    try {
      // Check if exists
      const { data: existing } = await supabaseClient.from('users').select('id').eq('username', un).single();
      if (existing) {
        setError('Username already taken');
        return;
      }

      // Insert
      const { data: _data, error: insertError } = await supabaseClient
        .from('users')
        .insert([{ username: un, password: pw, name, email, role, emoji }])
        .select()
        .single();

      if (insertError) {
        setError('Error creating account: ' + insertError.message);
      } else {
        updateApp({ user: un, role: role, name: name, prevPage: 'profile', emoji });
        navigate('/profile');
      }
    } catch (err) {
      setError('Exception: ' + err.message);
    }
  };

  return (
    <div className="page active" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {showAdminPopup && (
        <div className="modal-bg" style={{ zIndex: 9999, backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-box" style={{ width: '100%', maxWidth: '380px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: '24px', boxShadow: '0 40px 80px rgba(0,0,0,0.2)', animation: 'popIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)', overflow: 'hidden', padding: 0 }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.9))', padding: '24px', borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.25)' }}>
                    <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>⚙️</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Admin Access</h3>
                </div>
                <button onClick={() => setShowAdminPopup(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.8)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.8)'}>✕</button>
              </div>
            </div>
            
            <div style={{ padding: '32px 24px' }}>
              <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '24px', marginTop: '0', lineHeight: 1.5 }}>Please authenticate with your master password to access secure system controls and platform data.</p>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                if (adminPwd === 'assara' || adminPwd === 'admin123') {
                  updateApp({ user: 'admin_sys', role: 'admin', name: 'System Admin', emoji: '⚙️', prevPage: 'admin' });
                  navigate('/admin');
                } else {
                  setAdminErr('Incorrect master password');
                }
              }}>
                <div style={{ position: 'relative', marginBottom: adminErr ? '12px' : '24px' }}>
                  <input 
                    type={showAdminPwd ? "text" : "password"} 
                    autoFocus
                    placeholder="Enter master password..." 
                    value={adminPwd}
                    onChange={e => { setAdminPwd(e.target.value); setAdminErr(''); }}
                    style={{ width: '100%', padding: '14px 45px 14px 16px', borderRadius: '12px', border: adminErr ? '2px solid #ef4444' : '2px solid #e2e8f0', fontSize: '1.05rem', background: '#f8fafc', color: '#0f172a', transition: 'all 0.2s', outline: 'none' }}
                    onFocus={e => e.currentTarget.style.borderColor = adminErr ? '#ef4444' : '#10b981'}
                    onBlur={e => e.currentTarget.style.borderColor = adminErr ? '#ef4444' : '#e2e8f0'}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowAdminPwd(!showAdminPwd)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.6, padding: '4px', transition: 'opacity 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.opacity = '1'}
                    onMouseOut={e => e.currentTarget.style.opacity = '0.6'}
                    title={showAdminPwd ? "Hide password" : "Show password"}
                  >
                    {showAdminPwd ? '🙈' : '👁️'}
                  </button>
                </div>
                
                {adminErr && (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                    <span>⚠️</span> {adminErr}
                  </div>
                )}
                
                <button type="submit" style={{ width: '100%', background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: 'none', color: 'white', padding: '14px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 10px 25px rgba(15, 23, 42, 0.3)' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(15, 23, 42, 0.4)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(15, 23, 42, 0.3)'; }}>
                  🔐 Authenticate Access
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="login-card" style={{ maxWidth: '460px', width: '100%' }}>
        <div className="login-logo" style={{ position: 'relative' }}>
          <div className="licon">🌱</div>
          <div>
            <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.4rem', color: 'var(--g1)' }}>Zero Hunger P2P</h1>
            <span style={{ fontSize: '.78rem', color: 'var(--txt3)' }}>AI-Enhanced Community Food Network</span>
          </div>
          <button 
            title="Admin Login"
            style={{ 
              position: 'absolute', right: 0, top: 0, 
              background: 'transparent', border: 'none', 
              fontSize: '1.2rem', cursor: 'pointer', opacity: 0.6,
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
            onClick={() => setShowAdminPopup(true)}
          >
            ⚙️
          </button>
        </div>
        
        <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px', marginBottom: '22px' }}>
          <button 
            onClick={() => setTab('signin')} 
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s', ...(tab === 'signin' ? { background: 'linear-gradient(135deg,var(--g2),var(--t1))', color: '#fff' } : { background: 'transparent', color: 'var(--txt2)' }) }}>
            🔐 Sign In
          </button>
          <button 
            onClick={() => setTab('signup')} 
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s', ...(tab === 'signup' ? { background: 'linear-gradient(135deg,var(--g2),var(--t1))', color: '#fff' } : { background: 'transparent', color: 'var(--txt2)' }) }}>
            ✏️ Sign Up
          </button>
        </div>
        
        {tab === 'signin' ? (
          <div>
            <form onSubmit={handleLogin}>
              <div className="fg"><label>Email / Username</label><input name="username" type="text" placeholder="Enter email or username" /></div>
              <div className="fg"><label>Password</label><input name="password" type="password" placeholder="Enter password" /></div>
              <div style={{ color: 'var(--r1)', fontSize: '.8rem', marginBottom: '12px', minHeight: '18px' }}>{error}</div>
              <button type="submit" className="btn btn-primary btn-full">🔐 Sign In</button>
            </form>
          </div>
        ) : (
          <div>
            <form onSubmit={handleSignup}>
              <div className="fg"><label>Full Name / Trust Name *</label><input name="name" type="text" placeholder="Your full name or Trust name" required /></div>
              <div className="fg"><label>Email *</label><input name="email" type="email" placeholder="your@email.com" required /></div>
              <div className="fg"><label>Username *</label><input name="username" type="text" placeholder="Choose a username" required /></div>
              <div className="fg"><label>Password *</label><input name="password" type="password" placeholder="Min. 6 characters" required minLength="6" /></div>
              <div className="fg"><label>Role *</label>
                <select name="role">
                  <option value="user">👤 Community Member</option>
                  <option value="trust">🏛️ Trust / NGO</option>
                </select>
              </div>
              <div style={{ color: 'var(--r1)', fontSize: '.8rem', marginBottom: '12px', minHeight: '18px' }}>{error}</div>
              <button type="submit" className="btn btn-primary btn-full">🚀 Create Account</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
