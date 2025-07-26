import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Debtor {
  id: string;
  name: string;
  phone_number: string;
}

export default function AddDebtPage() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [selectedDebtor, setSelectedDebtor] = useState<string>('');

  // Redirect if user doesn't have write permissions
  if (userRole !== 'admin' && userRole !== 'staff') {
    navigate('/');
    return null;
  }

  useEffect(() => {
    fetchDebtors();
  }, []);

  const fetchDebtors = async () => {
    try {
      const { data, error } = await supabase
        .from('debtors')
        .select('id, name, phone_number')
        .order('name');

      if (error) throw error;
      setDebtors(data || []);
    } catch (error) {
      console.error('Error fetching debtors:', error);
      toast({
        title: "Error",
        description: "Failed to load debtors",
        variant: "destructive",
      });
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
    const reason = formData.get('reason') as string;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('debts')
        .insert({
          debtor_id: selectedDebtor,
          amount,
          reason: reason.trim(),
          created_by: user.id,
        });

      if (error) throw error;

      const selectedDebtorName = debtors.find(d => d.id === selectedDebtor)?.name || 'Unknown';
      
      toast({
        title: "Debt Recorded",
        description: `$${amount.toFixed(2)} debt recorded for ${selectedDebtorName}`,
      });

      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record debt",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navigation />
      
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Record New Debt</CardTitle>
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
                        {debtor.name} - {debtor.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Debt *</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  placeholder="What was the money taken for?"
                  required
                  rows={3}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading || !selectedDebtor} className="flex-1">
                  {loading ? 'Recording...' : 'Record Debt'}
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
                No debtors found. You need to register a debtor first.
              </p>
              <Button onClick={() => navigate('/add-debtor')}>
                Register New Debtor
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}