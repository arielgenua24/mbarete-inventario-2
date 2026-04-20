import { useState, useEffect } from 'react';
import LeftSidebar from '../../components/LeftSidebar';
import RightAnalyticsPanel from '../../components/RightAnalyticsPanel';
import './DesktopHomeLayout.css';

const DESKTOP_BREAKPOINT = 1100;

function DesktopHomeLayout({ children }) {
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= DESKTOP_BREAKPOINT
  );

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (!isDesktop) return children;

  return (
    <div className="dhl-root">
      <LeftSidebar />
      <main className="dhl-center">
        {children}
      </main>
      <RightAnalyticsPanel />
    </div>
  );
}

export default DesktopHomeLayout;
