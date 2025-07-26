import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Phone, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface DebtorWithHistory {
  id: string;
  name: string;
  phone_number: string;
  guarantor_name?: string;
  guarantor_phone?: string;
  total_debt: number;
  total_paid: number;
  balance: number;
  debts: Array<{
    id: string;
    amount: number;
    reason: string;
    date_recorded: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    date_paid: string;
  }>;
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<DebtorWithHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    
    try {
      // Search for debtor by name or phone
      const { data: debtorData, error: debtorError } = await supabase
        .from('debtors')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`)
        .single();

      if (debtorError) {
        setSearchResult(null);
        return;
      }

      // Get debts and payments for this debtor
      const [debtsResult, paymentsResult] = await Promise.all([
        supabase
          .from('debts')
          .select('*')
          .eq('debtor_id', debtorData.id)
          .order('date_recorded', { ascending: false }),
        supabase
          .from('payments')
          .select('*')
          .eq('debtor_id', debtorData.id)
          .order('date_paid', { ascending: false })
      ]);

      const debts = debtsResult.data || [];
      const payments = paymentsResult.data || [];

      const totalDebt = debts.reduce((sum, debt) => sum + Number(debt.amount), 0);
      const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

      setSearchResult({
        ...debtorData,
        total_debt: totalDebt,
        total_paid: totalPaid,
        balance: totalDebt - totalPaid,
        debts,
        payments,
      });
    } catch (error) {
      console.error('Error searching:', error);
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div>
      <Navigation />
      
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-4">Search Debtor</h1>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !searchTerm.trim()}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>

        {hasSearched && !loading && (
          <>
            {searchResult ? (
              <div className="space-y-6">
                {/* Debtor Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {searchResult.name}
                      <span className={`px-2 py-1 rounded text-xs ${
                        searchResult.balance > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {searchResult.balance > 0 ? 'Outstanding Debt' : 'Paid Up'}
                      </span>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {searchResult.phone_number}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-secondary rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Borrowed</p>
                        <p className="text-2xl font-bold">{formatCurrency(searchResult.total_debt)}</p>
                      </div>
                      <div className="text-center p-4 bg-secondary rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Paid</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(searchResult.total_paid)}</p>
                      </div>
                      <div className="text-center p-4 bg-secondary rounded-lg">
                        <p className="text-sm text-muted-foreground">Current Balance</p>
                        <p className={`text-2xl font-bold ${
                          searchResult.balance > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(searchResult.balance)}
                        </p>
                      </div>
                    </div>
                    
                    {searchResult.guarantor_name && (
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Guarantor Information</h4>
                        <p>Name: {searchResult.guarantor_name}</p>
                        {searchResult.guarantor_phone && (
                          <p>Phone: {searchResult.guarantor_phone}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Transaction History */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Debt History */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Debt History</CardTitle>
                      <CardDescription>{searchResult.debts.length} transactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {searchResult.debts.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No debt records found</p>
                      ) : (
                        <div className="space-y-3">
                          {searchResult.debts.map((debt) => (
                            <div key={debt.id} className="flex items-start gap-3 p-3 border rounded-lg">
                              <DollarSign className="h-5 w-5 text-red-500 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium">{formatCurrency(Number(debt.amount))}</p>
                                <p className="text-sm text-muted-foreground">{debt.reason}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(debt.date_recorded), 'MMM dd, yyyy')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Payment History */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Payment History</CardTitle>
                      <CardDescription>{searchResult.payments.length} transactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {searchResult.payments.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No payment records found</p>
                      ) : (
                        <div className="space-y-3">
                          {searchResult.payments.map((payment) => (
                            <div key={payment.id} className="flex items-start gap-3 p-3 border rounded-lg">
                              <DollarSign className="h-5 w-5 text-green-500 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium">{formatCurrency(Number(payment.amount))}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(payment.date_paid), 'MMM dd, yyyy')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    No debtor found with that name or phone number.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}