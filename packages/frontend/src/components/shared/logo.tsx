import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  variant?: 'mark' | 'full';
};

function isDark() {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function Logo({ className, variant = 'mark' }: LogoProps) {
  const [darkMode, setDarkMode] = useState(isDark);

  useEffect(() => {
    const updateTheme = () => setDarkMode(isDark());
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', updateTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', updateTheme);
    };
  }, []);

  const fileName = variant === 'full'
    ? (darkMode ? 'logo-tema-claro.svg' : 'logo-tema-escuro.svg')
    : (darkMode ? 'logo-tema-escuro.svg' : 'logo-tema-claro.svg');

  return (
    <img
      src={`/brand/${fileName}`}
      alt="OxeDinDin"
      className={cn('object-contain', className)}
    />
  );
}