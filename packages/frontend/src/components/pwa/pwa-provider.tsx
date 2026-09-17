import { usePwaRegister } from '@/hooks/use-pwa-register';
import { toast } from '@/components/ui/use-toast';

export function PwaProvider() {
  usePwaRegister(
    () => {
      toast({
        title: 'Nova versão disponível',
        description: 'Recarregue para atualizar o aplicativo.',
      });
    },
    () => {
      toast({ title: 'OxeDinDin', description: 'Pronto para funcionar offline.' });
    },
  );

  return null;
}