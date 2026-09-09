import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function DebtsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dívidas</h1>
          <p className="text-muted-foreground">Gerencie suas dívidas e valores a receber</p>
        </div>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Nova Dívida
        </Button>
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