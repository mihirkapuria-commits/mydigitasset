
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
import { BlogSection } from './components/BlogSection';
import { OffersSection } from './components/OffersSection';
import { UtilitiesSection } from './components/UtilitiesSection';
import { ContactSection } from './components/ContactSection';
import { PrivacyPolicySection } from './components/PrivacyPolicySection';
import { Category, User } from './types';

type ViewType = 'home' | 'dashboard' | 'admin' | 'blog' | 'offers' | 'utilities' | 'contact' | 'privacy';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('mydigitasset_token'));
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [selectedAuthCategory, setSelectedAuthCategory] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const catRes = await fetch('/api/categories');

        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData);
        }

        const params = new URLSearchParams(window.location.search);
        const adminOAuthCode = params.get('admin_oauth_code');

        if (adminOAuthCode) {
          // Remove the short-lived handoff code from the visible address bar immediately.
          window.history.replaceState({}, document.title, window.location.pathname);
          const sessionRes = await fetch('/api/auth/google/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: adminOAuthCode })
          });
          const sessionData = await sessionRes.json();
          if (!sessionRes.ok) {
            throw new Error(sessionData.error || 'Administrator Google sign-in failed.');
          }

          localStorage.setItem('mydigitasset_token', sessionData.token);
          setToken(sessionData.token);
          setCurrentUser(sessionData.user);
          setCurrentView('admin');
        } else {
          const savedToken = localStorage.getItem('mydigitasset_token');

          if (savedToken) {
            const userRes = await fetch('/api/auth/me', {
              headers: {
                Authorization: `Bearer ${savedToken}`
              }
            });

            if (userRes.ok) {
              const userData = await userRes.json();
              setCurrentUser(userData);
              setToken(savedToken);
              if (userData.role === 'admin') setCurrentView('admin');
            } else {
              localStorage.removeItem('mydigitasset_token');
              setToken(null);
              setCurrentUser(null);
            }
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
        if (new URLSearchParams(window.location.search).has('admin_oauth_code')) {
          window.history.replaceState({}, document.title, window.location.pathname);
          window.alert(err instanceof Error ? err.message : 'Administrator Google sign-in failed. Please try again.');
        }
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

  const handleLogout = async () => {
    const currentToken = token || localStorage.getItem('mydigitasset_token');

    try {
      if (currentToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        });
      }
    } catch (err) {
      console.error('Server logout request failed:', err);
    } finally {
      localStorage.removeItem('mydigitasset_token');
      setToken(null);
      setCurrentUser(null);
      setCurrentView('home');
    }
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
          if (mode === 'register') setSelectedAuthCategory(undefined);
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
            <Hero
              onStartTrial={() => {
                if (currentUser) {
                  setCurrentView('dashboard');
                } else {
                  setSelectedAuthCategory(undefined);
                  setAuthMode('register');
                  setIsAuthOpen(true);
                }
              }}
            />

            <CategoriesSection
              categories={categories}
              onSelectCategory={(categoryId) => {
                if (currentUser) {
                  setCurrentView('dashboard');
                } else {
                  setSelectedAuthCategory(categoryId);
                  setAuthMode('register');
                  setIsAuthOpen(true);
                }
              }}
            />

            <PricingSection
              onStartTrial={() => {
                if (currentUser) {
                  setCurrentView('dashboard');
                } else {
                  setSelectedAuthCategory(undefined);
                  setAuthMode('register');
                  setIsAuthOpen(true);
                }
              }}
            />

            <HowItWorks />
            <FAQSection />
          </>
        )}

        {currentView === 'blog' && (
          <BlogSection onNavigateHome={() => setCurrentView('home')} />
        )}

        {currentView === 'offers' && (
          <OffersSection
            onNavigateHome={() => setCurrentView('home')}
            onStartTrial={() => {
              if (currentUser) {
                setCurrentView('dashboard');
              } else {
                setSelectedAuthCategory(undefined);
                setAuthMode('register');
                setIsAuthOpen(true);
              }
            }}
          />
        )}

        {currentView === 'utilities' && (
          <UtilitiesSection onNavigateHome={() => setCurrentView('home')} />
        )}

        {currentView === 'contact' && (
          <ContactSection onNavigateHome={() => setCurrentView('home')} />
        )}

        {currentView === 'privacy' && (
          <PrivacyPolicySection onNavigateHome={() => setCurrentView('home')} />
        )}

        {currentView === 'dashboard' && currentUser && (
          <CustomerDashboard
            currentUser={currentUser}
            categories={categories}
            token={token!}
            onUpdateUser={(updated) => setCurrentUser(updated)}
            onLogout={handleLogout}
          />
        )}

        {currentView === 'admin' && currentUser && (
          <AdminPortal
            currentUser={currentUser}
            token={token!}
            onLogout={handleLogout}
            categories={categories}
          />
        )}
      </main>

      <Footer onNavigate={(view) => setCurrentView(view)} />

      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        initialCategory={selectedAuthCategory}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        categories={categories}
      />
    </div>
  );
}
