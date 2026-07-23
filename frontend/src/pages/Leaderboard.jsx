import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';

export default function Leaderboard() {
  const navigate = useNavigate();
  const { type } = useParams();
  const boardType = type === 'volunteer' ? 'volunteer' : 'donor';
  const { db, appState } = useAppContext();
  const [timeFilter, setTimeFilter] = useState('today'); // 'today' | 'all_time'

  // Aggregate and sort leaderboard data
  const leaderboard = useMemo(() => {
    let targetDonations = db.donations || [];

    // Filter by date if "Today" is selected
    if (timeFilter === 'today') {
      const todayStr = new Date().toDateString();
      targetDonations = targetDonations.filter(d => {
        if (!d.created_at) return false;
        return new Date(d.created_at).toDateString() === todayStr;
      });
    }

    // Group by user
    const userStats = {};
    targetDonations.forEach(d => {
      const username = (d.donor_username || d.donor_name || 'Anonymous').toLowerCase();
      // Match emoji from users table if possible, otherwise fallback
      // Since we don't fetch all users to context yet, we'll try to get appState.emoji if it's the current user
      const isMe = username === (appState.user || '').toLowerCase();
      
      if (!userStats[username]) {
        userStats[username] = {
          username: d.donor_username || d.donor_name || 'Anonymous',
          name: d.donor_name || d.donor_username || 'Anonymous',
          totalQuantity: 0,
          donationsCount: 0,
          isMe: isMe
        };
      }
      userStats[username].totalQuantity += (d.quantity || 0);
      userStats[username].donationsCount += 1;
    });

    // Convert to array and sort by total quantity (descending)
    let sorted = Object.values(userStats).sort((a, b) => b.totalQuantity - a.totalQuantity);
    
    // Fallback: if today is completely empty, we can just return empty array
    return sorted;
  }, [db.donations, timeFilter, appState.user]);

  const volunteerLeaderboard = useMemo(() => {
    let targetRequests = db.requests || [];
    if (timeFilter === 'today') {
      const todayStr = new Date().toDateString();
      targetRequests = targetRequests.filter(r => {
        if (!r.created_at) return false;
        return new Date(r.created_at).toDateString() === todayStr;
      });
    }
    
    // Only count completed deliveries where a volunteer was assigned
    targetRequests = targetRequests.filter(r => r.status === 'completed' && r.assigned_to);

    const vStats = {};
    targetRequests.forEach(r => {
      const vName = r.assigned_to;
      const key = vName.toLowerCase();
      const isMe = key === (appState.user || '').toLowerCase() || key === (appState.name || '').toLowerCase();
      
      if (!vStats[key]) {
        vStats[key] = {
          username: vName,
          name: vName,
          totalScore: 0,
          deliveriesCount: 0,
          isMe
        };
      }
      vStats[key].deliveriesCount += 1;
      vStats[key].totalScore += 1; // 1 completed delivery = 1 score
    });

    return Object.values(vStats).sort((a, b) => b.totalScore - a.totalScore);
  }, [db.requests, timeFilter, appState.user, appState.name]);

  const activeLeaderboard = boardType === 'donor' ? leaderboard : volunteerLeaderboard;
  const top3 = activeLeaderboard.slice(0, 3);
  const restList = activeLeaderboard.slice(3);

  // Helper to ensure podium always has exactly 3 slots for visual balance even if empty
  const getPodiumUser = (index) => top3[index] || { name: '—', totalQuantity: 0, donationsCount: 0, totalScore: 0 };

  const myTotalDonations = leaderboard.find(l => l.isMe)?.donationsCount || 0;
  const myTotalDeliveries = volunteerLeaderboard.find(l => l.isMe)?.deliveriesCount || 0;

  return (
    <div className="page active lb-page">
      {/* Navbar Minimal */}
      <div className="navbar" style={{ background: 'transparent', boxShadow: 'none' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ color: 'var(--txt)', borderColor: 'var(--border)' }}>
          ← Back to Dashboard
        </button>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
        
        {/* Header section */}
        <div className="lb-header">
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{boardType === 'donor' ? '🎁' : '🚗'}</div>
          <h1 className="lb-title">{boardType === 'donor' ? 'Top Donors Board' : 'Micro-Volunteers Board'}</h1>
          <p className="lb-subtitle">See who is leading the fight against hunger</p>
        </div>

        {/* Time Filter Toggle */}
        <div className="lb-toggle-wrap">
          <div className="lb-toggle" style={{ margin: '0 auto' }}>
            <button 
              className={`lb-toggle-btn ${timeFilter === 'today' ? 'active' : ''}`} 
              onClick={() => setTimeFilter('today')}
            >
              Today
            </button>
            <button 
              className={`lb-toggle-btn ${timeFilter === 'all_time' ? 'active' : ''}`} 
              onClick={() => setTimeFilter('all_time')}
            >
              All Time
            </button>
          </div>
        </div>

        {/* My Stats Banner */}
        <div style={{ background: 'linear-gradient(135deg, var(--card), var(--bg))', padding: '15px 25px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: '40px', margin: '20px 0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          {boardType === 'donor' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--txt1)', fontWeight: 600, textTransform: 'uppercase' }}>My Donations</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--g1)' }}>{myTotalDonations}</div>
            </div>
          )}
          {boardType === 'volunteer' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--txt1)', fontWeight: 600, textTransform: 'uppercase' }}>My Deliveries</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>{myTotalDeliveries}</div>
            </div>
          )}
        </div>

        {activeLeaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--card)', borderRadius: '24px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '10px' }}>😴</div>
            <h3 style={{ color: 'var(--txt)', marginBottom: '8px' }}>No {boardType === 'donor' ? 'donations' : 'deliveries'} {timeFilter === 'today' ? 'today' : 'yet'}.</h3>
            <p style={{ color: 'var(--txt2)' }}>Be the first to step up and take the #1 spot!</p>
            <button className="btn btn-primary" onClick={() => navigate(boardType === 'donor' ? '/donor' : '/volunteer')} style={{ marginTop: '20px' }}>
              {boardType === 'donor' ? 'Donate Now' : 'Volunteer Now'}
            </button>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            <div className="podium-container">
              {/* Rank 2 (Silver) */}
              <div className="podium-item rank-2">
                <div className="podium-name">{getPodiumUser(1).name}</div>
                <div className="podium-stat">{boardType === 'donor' ? `${getPodiumUser(1).totalQuantity} units` : `${getPodiumUser(1).totalScore} deliveries`}</div>
                <div className="podium-avatar">{getPodiumUser(1).name !== '—' ? '🥈' : '👤'}</div>
                <div className="podium-box">2</div>
              </div>

              {/* Rank 1 (Gold) */}
              <div className="podium-item rank-1">
                <div className="podium-name">{getPodiumUser(0).name}</div>
                <div className="podium-stat">{boardType === 'donor' ? `${getPodiumUser(0).totalQuantity} units` : `${getPodiumUser(0).totalScore} deliveries`}</div>
                <div className="podium-avatar">{getPodiumUser(0).name !== '—' ? '👑' : '👤'}</div>
                <div className="podium-box">1</div>
              </div>

              {/* Rank 3 (Bronze) */}
              <div className="podium-item rank-3">
                <div className="podium-name">{getPodiumUser(2).name}</div>
                <div className="podium-stat">{boardType === 'donor' ? `${getPodiumUser(2).totalQuantity} units` : `${getPodiumUser(2).totalScore} deliveries`}</div>
                <div className="podium-avatar">{getPodiumUser(2).name !== '—' ? '🥉' : '👤'}</div>
                <div className="podium-box">3</div>
              </div>
            </div>

            {/* Ranks 4+ List */}
            {restList.length > 0 && (
              <div className="lb-list">
                {restList.map((user, index) => (
                  <div className="lb-row" key={user.username} style={{ animationDelay: `${0.1 * index}s` }}>
                    <div className="lb-rank">#{index + 4}</div>
                    <div className="lb-row-avatar">👤</div>
                    <div className="lb-row-info">
                      <div className="lb-row-name" style={{ color: user.isMe ? 'var(--g1)' : 'var(--txt)' }}>
                        {user.name} {user.isMe && <span className="badge bg-g" style={{ marginLeft: '6px' }}>YOU</span>}
                      </div>
                      <div className="lb-row-stats">{boardType === 'donor' ? `${user.donationsCount} donations` : `${user.totalScore} deliveries`}</div>
                    </div>
                    <div className="lb-row-score">{boardType === 'donor' ? user.totalQuantity : user.totalScore} <span style={{ fontSize: '0.6em', opacity: 0.7 }}>{boardType === 'donor' ? 'units' : 'del'}</span></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
