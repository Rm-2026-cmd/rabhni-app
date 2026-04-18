// src/components/BottomNav.jsx
export default function BottomNav({ current, onChange, isAdmin }) {
  const items = [
    { id: 'home', label: 'الرئيسية', icon: HomeIcon },
    { id: 'leaderboard', label: 'التصنيف', icon: TrophyIcon },
    { id: 'rewards', label: 'الجوائز', icon: GiftIcon },
    { id: 'profile', label: 'حسابي', icon: PersonIcon },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldIcon }] : []),
  ];

  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          className={`nav-item ${current === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <item.icon />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
);
const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
  </svg>
);
const GiftIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 6h-2.18c.07-.31.18-.62.18-.97C18 3.35 16.65 2 15.03 2c-.97 0-1.76.5-2.28 1.22l-.75.98-.75-.98C10.73 2.5 9.94 2 8.97 2 7.35 2 6 3.35 6 5.03c0 .35.11.66.18.97H4c-1.11 0-2 .89-2 2v3c0 .55.45 1 1 1h1v7c0 1.11.89 2 2 2h12c1.11 0 2-.89 2-2v-7h1c.55 0 1-.45 1-1V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-6 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM4 8h16v3H4V8zm2 11v-7h5v7H6zm7 0v-7h5v7h-5z"/>
  </svg>
);
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
  </svg>
);
