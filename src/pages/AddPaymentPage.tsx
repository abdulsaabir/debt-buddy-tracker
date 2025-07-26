import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface DebtorWithBalance {
  id: string;
  name: string;
  phone_number: string;
  balance: number;
}

export default function AddPaymentPage() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [debtors, setDebtors] = useState<DebtorWithBalance[]>([]);
  const [selectedDebtor, setSelectedDebtor] = useState<string>('');
  const [loadingDebtors, setLoadingDebtors] = useState(true);

  // Redirect if user doesn't have write permissions
  if (userRole !== 'admin' && userRole !== 'staff') {
    navigate('/');
    return null;
  }

  useEffect(() => {
    fetchDebtorsWithBalance();
  }, []);

  const fetchDebtorsWithBalance = async () => {
    try {
      const { data: debtorsData, error } = await supabase
        .from('debtors')
        .select('id, name, phone_number')
        .order('name');

      if (error) throw error;

      // Calculate balance for each debtor
      const debtorsWithBalance = await Promise.all(
        (debtorsData || []).map(async (debtor) => {
          const [debtsResult, paymentsResult] = await Promise.all([
            supabase
              .from('debts')
              .select('amount')
              .eq('debtor_id', debtor.id),
            supabase
              .from('payments')
              .select('amount')
              .eq('debtor_id', debtor.id)
          ]);

          const totalDebt = debtsResult.data?.reduce((sum, debt) => sum + Number(debt.amount), 0) || 0;
          const totalPaid = paymentsResult.data?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
          
          return {
            ...debtor,
            balance: totalDebt - totalPaid,
          };
        })
      );

      // Only show debtors with outstanding balance
      const debtorsWithOutstandingBalance = debtorsWithBalance.filter(debtor => debtor.balance > 0);
      setDebtors(debtorsWithOutstandingBalance);
    } catch (error) {
      console.error('Error fetching debtors:', error);
      toast({
        title: "Error",
        description: "Failed to load debtors",
        variant: "destructive",
      });
    } finally {
      setLoadingDebtors(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDebtor) {
      toast({
        title: "Error",
        description: "Please select a debtor",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));

    // Check if payment amount exceeds outstanding balance
    const debtor = debtors.find(d => d.id === selectedDebtor);
    if (debtor && amount > debtor.balance) {
      toast({
        title: "Error",
        description: `Payment amount ($${amount.toFixed(2)}) exceeds outstanding balance ($${debtor.balance.toFixed(2)})`,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('payments')
        .insert({
          debtor_id: selectedDebtor,
          amount,
          created_by: user.id,
        });

      if (error) throw error;

      const selectedDebtorName = debtors.find(d => d.id === selectedDebtor)?.name || 'Unknown';
      
      toast({
        title: "Payment Recorded",
        description: `$${amount.toFixed(2)} payment recorded for ${selectedDebtorName}`,
      });

      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedDebtorData = debtors.find(d => d.id === selectedDebtor);

  if (loadingDebtors) {
    return (
      <div>
        <Navigation />
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading debtors...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="debtor">Select Debtor *</Label>
                <Select value={selectedDebtor} onValueChange={setSelectedDebtor} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a debtor" />
                  </SelectTrigger>
                  <SelectContent>
                    {debtors.map((debtor) => (
                      <SelectItem key={debtor.id} value={debtor.id}>
                        {debtor.name} - {debtor.phone_number} (Owes: ${debtor.balance.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDebtorData && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${selectedDebtorData.balance.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedDebtorData?.balance || undefined}
                  placeholder="0.00"
                  required
                />
                {selectedDebtorData && (
                  <p className="text-sm text-muted-foreground">
                    Maximum payment: ${selectedDebtorData.balance.toFixed(2)}
                  </p>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading || !selectedDebtor} className="flex-1">
                  {loading ? 'Recording...' : 'Record Payment'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {debtors.length === 0 && (
          <Card className="mt-4">
            <CardContent className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                No debtors with outstanding balances found.
              </p>
              <Button onClick={() => navigate('/')}>
                View All Debtors
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}