import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Users, Plus, CreditCard, Search, UserPlus } from 'lucide-react';

export function Navigation() {
  const { userRole } = useAuth();
  const location = useLocation();

  const canWrite = userRole === 'admin' || userRole === 'staff';

  const navItems = [
    { path: '/', label: 'View Debtors', icon: Users },
    { path: '/search', label: 'Search', icon: Search },
    ...(canWrite ? [
      { path: '/add-debtor', label: 'Add Debtor', icon: UserPlus },
      { path: '/add-debt', label: 'Record Debt', icon: Plus },
      { path: '/add-payment', label: 'Record Payment', icon: CreditCard },
    ] : []),
  ];

  return (
    <nav className="mb-6">
      <div className="flex flex-wrap gap-2">
        {navItems.map(({ path, label, icon: Icon }) => (
          <Button
            key={path}
            asChild
            variant={location.pathname === path ? 'default' : 'outline'}
            size="sm"
          >
            <Link to={path} className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </Button>
        ))}
      </div>
    </nav>
  );
}