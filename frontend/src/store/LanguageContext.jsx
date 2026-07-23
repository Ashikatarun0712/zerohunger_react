/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    dashboard: 'Dashboard',
    settings: 'Settings',
    logout: 'Logout',
    myActivity: 'My Live Activity',
    donations: 'Donations',
    requests: 'Requests',
    cancel: 'Cancel',
    chat: 'Chat',
    refresh: 'Refresh',
    profile: 'Profile',
    language: 'Language',
  },
  es: {
    dashboard: 'Panel',
    settings: 'Ajustes',
    logout: 'Cerrar sesión',
    myActivity: 'Mi Actividad en Vivo',
    donations: 'Donaciones',
    requests: 'Solicitudes',
    cancel: 'Cancelar',
    chat: 'Chat',
    refresh: 'Actualizar',
    profile: 'Perfil',
    language: 'Idioma',
  },
  fr: {
    dashboard: 'Tableau de bord',
    settings: 'Paramètres',
    logout: 'Déconnexion',
    myActivity: 'Mon activité en direct',
    donations: 'Dons',
    requests: 'Demandes',
    cancel: 'Annuler',
    chat: 'Discuter',
    refresh: 'Actualiser',
    profile: 'Profil',
    language: 'Langue',
  },
  hi: {
    dashboard: 'डैशबोर्ड',
    settings: 'सेटिंग्स',
    logout: 'लॉग आउट',
    myActivity: 'मेरी लाइव गतिविधि',
    donations: 'दान',
    requests: 'अनुरोध',
    cancel: 'रद्द करें',
    chat: 'चैट',
    refresh: 'रीफ़्रेश करें',
    profile: 'प्रोफ़ाइल',
    language: 'भाषा',
  },
  ta: {
    dashboard: 'கட்டுப்பாட்டு அறை',
    settings: 'அமைப்புகள்',
    logout: 'வெளியேறு',
    myActivity: 'என் நேரலை செயல்பாடு',
    donations: 'நன்கொடைகள்',
    requests: 'கோரிக்கைகள்',
    cancel: 'ரத்து செய்',
    chat: 'அரட்டை',
    refresh: 'புதுப்பி',
    profile: 'சுயவிவரம்',
    language: 'மொழி',
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('en');

  const t = (key) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
