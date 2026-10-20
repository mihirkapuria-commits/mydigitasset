import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CategoriesSection } from './components/CategoriesSection';
import { PricingSection } from './components/PricingSection';
import { HowItWorks } from './components/HowItWorks';
import { FAQSection } from './components/FAQSection';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminPortal } from './components/AdminPortal';
import { Category, User } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('mydigitasset_token'));
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'dashboard' | 'admin'>('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [loading, setLoading] = useState(true);

  // Fetch categories & current user on mount
  useEffect(() => {
    async function init() {
      try {
        const catRes = await fetch('/api/categories');
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData);
        }

        const savedToken = localStorage.getItem('mydigitasset_token');
        if (savedToken) {
          const userRes = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${savedToken}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setCurrentUser(userData);
            setToken(savedToken);
          } else {
            localStorage.removeItem('mydigitasset_token');
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleAuthSuccess = (newToken: string, user: User) => {
    localStorage.setItem('mydigitasset_token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    if (user.email === 'mihirkapuria@gmail.com' && user.role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mydigitasset_token');
    setToken(null);
    setCurrentUser(null);
    setCurrentView('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-mono text-sm">
        Loading MyDigitAsset...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-indigo-600 selection:text-white">
      <Navbar
        currentUser={currentUser}
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setIsAuthOpen(true);
        }}
        onLogout={handleLogout}
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
      />

      <main className="flex-grow">
        {currentView === 'home' && (
          <>
            <Hero onStartTrial={() => {
              if (currentUser) {
                setCurrentView('dashboard');
              } else {
                setAuthMode('register');
                setIsAuthOpen(true);
              }
            }} />
            <CategoriesSection categories={categories} />
            <PricingSection onStartTrial={() => {
              if (currentUser) {
                setCurrentView('dashboard');
              } else {
                setAuthMode('register');
                setIsAuthOpen(true);
              }
            }} />
            <HowItWorks />
            <FAQSection />
          </>
        )}

        {currentView === 'dashboard' && currentUser && (
          <CustomerDashboard
            currentUser={currentUser}
            categories={categories}
            token={token!}
            onUpdateUser={(updated) => setCurrentUser(updated)}
          />
        )}

        {currentView === 'admin' && currentUser && (
          <AdminPortal
            currentUser={currentUser}
            token={token!}
          />
        )}
      </main>

      <Footer />

      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        categories={categories}
      />
    </div>
  );
}
