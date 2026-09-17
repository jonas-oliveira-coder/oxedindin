import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { toast } from '@/components/ui/use-toast';

export function InstallPWAButton({ variant = 'outline', className }: { variant?: 'outline' | 'default' | 'secondary'; className?: string }) {
  const { canInstall, isStandalone, promptInstall } = usePwaInstall();

  if (!canInstall || isStandalone) return null;

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result?.outcome === 'accepted') {
      toast({ title: 'OxeDinDin instalado', description: 'O aplicativo foi adicionado ao seu dispositivo.' });
    }
  };

  return (
    <Button variant={variant} className={className} onClick={handleInstall}>
      <Download className="mr-2 h-4 w-4" />
      Instalar aplicativo
    </Button>
  );
}