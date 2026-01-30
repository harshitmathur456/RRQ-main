import { useState } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { Dashboard } from '@/pages/Dashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = (hospitalId: string, password: string) => {
    // In production, this would validate against a backend
    console.log('Login attempt:', { hospitalId });
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <Dashboard onLogout={handleLogout} />
    </ErrorBoundary>
  );
};

export default Index;
