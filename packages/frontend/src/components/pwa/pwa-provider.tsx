import { usePwaRegister } from '@/hooks/use-pwa-register';

export function PwaProvider() {
  usePwaRegister();

  return null;
}