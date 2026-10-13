import { useEffect, useState } from 'react';
import { AppDataProvider, useApp } from './data/AppData';
import { FoodDataProvider } from './data/FoodData';
import { AuthScreen } from './screens/AuthScreen';
import { Onboarding } from './screens/Onboarding';
import { TodayScreen } from './screens/TodayScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PetScreen } from './screens/PetScreen';
import { FoodScreen } from './screens/FoodScreen';
import { Toast } from './components/ui';
import { PasswordSheet } from './components/PasswordSheet';
import { IconFork, IconGrid, IconHome, IconLeaf, IconUser } from './components/Icons';
import { tap } from './lib/haptics';
import { setStatusBar } from './lib/statusbar';

type Tab = 'today' | 'food' | 'progress' | 'pet' | 'profile';

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        aria-label="Loading"
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'var(--mint)',
          color: 'var(--forest)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          fontWeight: 800,
          animation: 'pop 0.6s var(--ease)',
        }}
      >
        75
      </div>
    </div>
  );
}

function Main() {
  const { status, today, error, clearError, passwordReset, dismissPasswordReset } = useApp();
  // Opened from a password-reset email: ask for the new password straight away.
  const [resetSheet, setResetSheet] = useState(passwordReset);
  useEffect(() => {
    if (passwordReset) setResetSheet(true);
  }, [passwordReset]);
  const [tab, setTab] = useState<Tab>('today');
  const [profileFocus, setProfileFocus] = useState<'about' | undefined>();
  const [date, setDate] = useState(today);

  // Roll over to the new day if the app was left open past midnight.
  useEffect(() => setDate(today), [today]);
  useEffect(() => window.scrollTo({ top: 0 }), [tab, date]);
  useEffect(() => {
    const green = status === 'loading' || status === 'signedOut' || (status === 'ready' && tab === 'today');
    setStatusBar(green ? 'green' : 'light');
  }, [status, tab]);

  const toast = (
    <>
      {error && <Toast message={error} onClose={clearError} />}
      {status !== 'signedOut' && status !== 'loading' && (
        <PasswordSheet
          open={resetSheet}
          fromEmail
          onClose={() => {
            setResetSheet(false);
            dismissPasswordReset();
          }}
        />
      )}
    </>
  );

  if (status === 'loading') return <Splash />;
  if (status === 'signedOut')
    return (
      <>
        <AuthScreen />
        {toast}
      </>
    );
  if (status === 'needsChallenge')
    return (
      <>
        <Onboarding />
        {toast}
      </>
    );

  const tabs: { id: Tab; label: string; icon: typeof IconHome }[] = [
    { id: 'today', label: 'Today', icon: IconHome },
    { id: 'food', label: 'Food', icon: IconFork },
    { id: 'progress', label: 'Progress', icon: IconGrid },
    { id: 'pet', label: 'Pet', icon: IconLeaf },
    { id: 'profile', label: 'Profile', icon: IconUser },
  ];

  return (
    <div className="shell">
      {tab === 'today' && (
        <TodayScreen
          key="today"
          date={date}
          setDate={setDate}
          openProgress={() => setTab('progress')}
          openFood={() => setTab('food')}
          openProfile={() => {
            setProfileFocus('about');
            setTab('profile');
          }}
        />
      )}
      {tab === 'food' && <FoodScreen date={date} setDate={setDate} />}
      {tab === 'pet' && <PetScreen />}
      {tab === 'progress' && (
        <ProgressScreen
          openDay={(d) => {
            setDate(d);
            setTab('today');
          }}
        />
      )}
      {tab === 'profile' && <ProfileScreen focus={profileFocus} />}

      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className="tab"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                tap();
                if (id === 'today' && tab === 'today') setDate(today);
                setProfileFocus(undefined);
                setTab(id);
              }}
            >
              <Icon size={24} strokeWidth={tab === id ? 2.3 : 2} />
              {label}
            </button>
          ))}
        </div>
      </nav>
      {toast}
    </div>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <FoodDataProvider>
        <Main />
      </FoodDataProvider>
    </AppDataProvider>
  );
}
