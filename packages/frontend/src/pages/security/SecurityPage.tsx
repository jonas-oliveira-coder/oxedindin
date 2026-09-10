import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SecurityPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Segurança</h1>
          <p className="text-muted-foreground">Gerencie sua segurança e dispositivos</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Esta página está sendo desenvolvida.</p>
        </CardContent>
      </Card>
    </div>
  );
}