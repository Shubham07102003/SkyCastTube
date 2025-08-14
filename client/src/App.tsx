import './App.css';
import WeatherSearch from './components/WeatherSearch';
import RecordsTable from './components/RecordsTable';
import YouTubeVideosTab from './components/YouTubeVideosTab';
import { useEffect, useState } from 'react';

export default function App() {
  const [tab, setTab] = useState<'weather' | 'records' | 'videos'>('weather');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme-mode');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme-mode', theme);
  }, [theme]);
  return (
    <div>
      <header className="appHeader">
        <div className="brand">SkyCastTube</div>
        <nav className="nav tabs">
          <button className={`button ${tab === 'weather' ? 'active' : ''}`} onClick={() => setTab('weather')}>Weather</button>
          <button className={`button ${tab === 'videos' ? 'active' : ''}`} onClick={() => setTab('videos')}>Videos</button>
          <button className={`button ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>Saved</button>
          <a href="/api/records/export?format=json" target="_blank" rel="noreferrer noopener"><button className="button">Export All JSON</button></a>
          <button className="button" onClick={() => setIsInfoOpen(true)} aria-haspopup="dialog" aria-expanded={isInfoOpen} title="About PM Accelerator">Info</button>
          <button className="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </nav>
      </header>
      {tab === 'weather' ? <WeatherSearch /> : tab === 'videos' ? <YouTubeVideosTab /> : <RecordsTable />}
      {isInfoOpen && (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="pma-title" onClick={() => setIsInfoOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h2 id="pma-title" style={{ margin: 0 }}>Product Manager Accelerator (PMA)</h2>
              <button className="closeButton" onClick={() => setIsInfoOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="modalBody">
              <p>
                The Product Manager Accelerator Program is designed to support PM professionals through every stage of their careers. From students looking for entry-level jobs to Directors looking to take on a leadership role, our program has helped hundreds of students fulfill their career aspirations.
              </p>
              <p>
                Our Product Manager Accelerator community are ambitious and committed. Through our program they have learnt, honed and developed new PM and leadership skills, giving them a strong foundation for their future endeavors.
              </p>
              <p>Here are examples of services we offer:</p>
              <ul>
                <li>
                  <strong>🚀 PMA Pro</strong>: End-to-end product manager job hunting program that helps you master FAANG-level Product Management skills, conduct unlimited mock interviews, and gain job referrals through our largest alumni network. 25% of our offers came from tier 1 companies and compensation can be as high as $800K/year.
                </li>
                <li>
                  <strong>🚀 AI PM Bootcamp</strong>: Gain hands-on AI Product Management skills by building a real-life AI product with a team of AI Engineers, data scientists, and designers. We also help you launch your product with real user engagement using our 100,000+ PM community and social media channels.
                </li>
                <li>
                  <strong>🚀 PMA Power Skills</strong>: Designed for existing product managers to sharpen their product management skills, leadership skills, and executive presentation skills.
                </li>
                <li>
                  <strong>🚀 PMA Leader</strong>: We help you accelerate your product management career, get promoted to Director and product executive levels, and win in the board room.
                </li>
                <li>
                  <strong>🚀 1:1 Resume Review</strong>: We help you rewrite your killer product manager resume to stand out, with an interview guarantee. Get started with the free template used by over 14,000 product managers: <a href="https://www.drnancyli.com/pmresume" target="_blank" rel="noreferrer noopener">drnancyli.com/pmresume</a>.
                </li>
                <li>
                  <strong>🚀 500+ free trainings</strong>: Start learning for free on YouTube and Instagram:
                  {' '}<a href="https://www.youtube.com/c/drnancyli" target="_blank" rel="noreferrer noopener">YouTube</a>
                  {' '}and @drnancyli on Instagram.
                </li>
              </ul>
              <div style={{ marginTop: 12 }}>
                <div><strong>Website</strong>: <a href="https://www.pmaccelerator.io/" target="_blank" rel="noreferrer noopener">pmaccelerator.io</a></div>
                <div><strong>Phone</strong>: <a href="tel:+19548891063">+1 (954) 889-1063</a></div>
                <div><strong>Industry</strong>: E‑Learning Providers</div>
                <div><strong>Company size</strong>: 2–10 employees</div>
                <div><strong>Headquarters</strong>: Boston, MA</div>
                <div><strong>Founded</strong>: 2020</div>
                <div style={{ marginTop: 8 }}>
                  <strong>Specialties</strong>: Product Management, Product Manager, Product Management Training, Product Management Certification, Product Lead, Product Executive, Associate Product Manager, product management coaching, product manager resume, Product Management Interview, VP of Product, Director of Product, Chief Product Officer, and AI Product Management
                </div>
              </div>
              <p style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
                Find more details on our LinkedIn page:
                {' '}<a href="https://www.linkedin.com/company/product-manager-accelerator/" target="_blank" rel="noreferrer noopener">Product Manager Accelerator</a>.
              </p>
            </div>
          </div>
        </div>
      )}
      <footer className="footer">Data by Open‑Meteo and OpenStreetMap Nominatim</footer>
    </div>
  );
}

