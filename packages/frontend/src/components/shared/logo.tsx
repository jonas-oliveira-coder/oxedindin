import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type LogoProps = {
  variant?: 'icon' | 'wordmark';
  className?: string;
};

function getInitialDarkMode() {
  if (typeof window === 'undefined') return false;

  const savedMode = localStorage.getItem('drizzle-dark-mode');
  return savedMode ? savedMode === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function Logo({ variant = 'icon', className }: LogoProps) {
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => {
      const savedMode = localStorage.getItem('drizzle-dark-mode');
      setDarkMode(savedMode ? savedMode === 'true' : document.documentElement.classList.contains('dark') || mediaQuery.matches);
    };
    const observer = new MutationObserver(updateTheme);

    mediaQuery.addEventListener('change', updateTheme);
    window.addEventListener('storage', updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mediaQuery.removeEventListener('change', updateTheme);
      window.removeEventListener('storage', updateTheme);
      observer.disconnect();
    };
  }, []);

  const suffix = darkMode ? 'branco' : 'preto';
  const fileName = variant === 'wordmark' ? `oxedin-nome-${suffix}.png` : `oxedin-${suffix}.png`;

  return (
    <img
      src={`/brand/${fileName}`}
      alt="OxeDinDin"
      className={cn('object-contain', className)}
    />
  );
}