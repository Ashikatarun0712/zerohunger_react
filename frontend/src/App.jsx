import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from './store/AppContext';
import { LanguageProvider } from './store/LanguageContext';
import ChatBot from './components/ChatBot';

// Import Pages
import Login from './pages/Login';
import Profile from './pages/Profile';
import Donor from './pages/Donor';
import Request from './pages/Request';
import Volunteer from './pages/Volunteer';
import Activity from './pages/Activity';
import Admin from './pages/Admin';
import Trust from './pages/Trust';

function App() {
  const { appState, syncDatabase } = useAppContext();

  useEffect(() => {
    // Initial sync
    syncDatabase();
    
    // Sync every 30 seconds to simulate real-time
    const interval = setInterval(() => {
      syncDatabase();
    }, 30000);

    return () => clearInterval(interval);
  }, [syncDatabase]);

  return (
    <LanguageProvider>
      <Router>
        <div className="toast-wrap" id="toasts"></div>
        {appState.user && <ChatBot />}
        
        <Routes>
          <Route path="/" element={appState.user ? <Navigate to={`/${appState.prevPage}`} /> : <Login />} />
          
          {/* Protected Routes */}
          <Route path="/profile" element={appState.user ? <Profile /> : <Navigate to="/" />} />
          <Route path="/donor" element={appState.user ? <Donor /> : <Navigate to="/" />} />
          <Route path="/request" element={appState.user ? <Request /> : <Navigate to="/" />} />
          <Route path="/volunteer" element={appState.user ? <Volunteer /> : <Navigate to="/" />} />
          <Route path="/activity" element={appState.user ? <Activity /> : <Navigate to="/" />} />
          <Route path="/admin" element={appState.user ? <Admin /> : <Navigate to="/" />} />
        <Route path="/trust" element={appState.user ? <Trust /> : <Navigate to="/" />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
    </LanguageProvider>
  );
}

export default App;
