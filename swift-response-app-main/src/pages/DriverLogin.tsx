import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriver } from '@/contexts/DriverContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ambulance, Phone, IdCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DriverLogin: React.FC = () => {
  const [driverId, setDriverId] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useDriver();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!driverId || !phone) {
      toast({
        title: 'Missing Information',
        description: 'Please enter your Driver ID and phone number.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    login(driverId, phone);
    
    toast({
      title: 'Login Successful',
      description: 'Welcome back, Driver!',
    });
    
    navigate('/dashboard');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="mb-8 text-center fade-in">
          <div className="w-20 h-20 bg-gradient-to-br from-emergency to-emergency/80 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-emergency">
            <Ambulance className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Driver Portal</h1>
          <p className="text-muted-foreground mt-1">Emergency Response System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 slide-up">
          <div className="space-y-2">
            <Label htmlFor="driverId" className="text-foreground">Driver ID</Label>
            <div className="relative">
              <IdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="driverId"
                type="text"
                placeholder="Enter your Driver ID"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="pl-11 h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-11 h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="emergency"
            size="full"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Contact dispatch if you need help accessing your account
          </p>
        </form>
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-xs text-muted-foreground">
          Emergency Response Driver App v1.0
        </p>
      </div>
    </div>
  );
};

export default DriverLogin;
