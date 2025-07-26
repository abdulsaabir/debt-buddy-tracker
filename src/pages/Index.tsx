import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Phone, Users } from 'lucide-react';

interface Debtor {
  id: string;
  name: string;
  phone_number: string;
  guarantor_name?: string;
  guarantor_phone?: string;
  total_debt: number;
  total_paid: number;
  balance: number;
}

const Index = () => {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDebtors();
  }, []);

  const fetchDebtors = async () => {
    try {
      // Get debtors with calculated totals
      const { data: debtorsData, error: debtorsError } = await supabase
        .from('debtors')
        .select('*')
        .order('name');

      if (debtorsError) throw debtorsError;

      // Calculate totals for each debtor
      const debtorsWithTotals = await Promise.all(
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
            total_debt: totalDebt,
            total_paid: totalPaid,
            balance: totalDebt - totalPaid,
          };
        })
      );

      setDebtors(debtorsWithTotals);
    } catch (error) {
      console.error('Error fetching debtors:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDebtors = debtors.filter(debtor =>
    debtor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debtor.phone_number.includes(searchTerm)
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
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
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Debt Management Dashboard</h1>
          <Badge variant="outline" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {debtors.length} Total Debtors
          </Badge>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by name or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredDebtors.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? 'No debtors found matching your search.' : 'No debtors registered yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDebtors.map((debtor) => (
              <Card key={debtor.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{debtor.name}</span>
                    <Badge 
                      variant={debtor.balance > 0 ? 'destructive' : 'default'}
                    >
                      {debtor.balance > 0 ? 'Owes' : 'Paid'}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {debtor.phone_number}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Borrowed:</span>
                      <span className="font-medium">{formatCurrency(debtor.total_debt)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Paid:</span>
                      <span className="font-medium text-green-600">{formatCurrency(debtor.total_paid)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-bold">
                        <span>Current Balance:</span>
                        <span className={debtor.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(debtor.balance)}
                        </span>
                      </div>
                    </div>
                    {debtor.guarantor_name && (
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                        <p>Guarantor: {debtor.guarantor_name}</p>
                        {debtor.guarantor_phone && (
                          <p>Phone: {debtor.guarantor_phone}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
