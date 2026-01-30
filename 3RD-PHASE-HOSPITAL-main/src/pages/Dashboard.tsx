import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { mockHospital } from '@/data/mockData';
import { EmergencyAlert } from '@/types/hospital';
import { DashboardHeader } from '@/components/DashboardHeader';
import { StatsPanel } from '@/components/StatsPanel';
import { EmergencyCard } from '@/components/EmergencyCard';
import { PatientProfile } from '@/components/PatientProfile';
import { AmbulanceTracker } from '@/components/AmbulanceTracker';
import { ArrivalPanel } from '@/components/ArrivalPanel';
import { AbhaLookup } from '@/components/AbhaLookup';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, AlertTriangle, CheckCircle, CreditCard } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [selectedEmergency, setSelectedEmergency] = useState<EmergencyAlert | null>(null);
  const [activeTab, setActiveTab] = useState('incoming');
  const { toast } = useToast();

  const HOSPITAL_ID = 'hosp-001';
  const MGH_DATA = { ...mockHospital, id: HOSPITAL_ID, name: "Mahatma Gandhi Hospital (MGH)" };

  const incomingEmergencies = emergencies.filter(e => e.status === 'incoming');
  const arrivedEmergencies = emergencies.filter(e => e.status === 'arrived' || e.status === 'admitted');

  const handleViewDetails = (id: string) => {
    const emergency = emergencies.find(e => e.id === id);
    if (emergency) {
      setSelectedEmergency(emergency);
    }
  };

  const processIncomingRequest = async (requestData: any) => {
    try {
      console.log(`Processing request ${requestData.id}`);

      // Fetch Medical Profile
      let medicalProfile: any = null;
      if (requestData.user_id) {
        const { data, error } = await supabase
          .from('medical_profiles' as any)
          .select('*')
          .eq('user_id', requestData.user_id)
          .maybeSingle();

        if (!error && data) {
          medicalProfile = data;
        }
      }

      // Default to JECC Sitapura coordinates
      const jeccLat = 26.7744;
      const jeccLng = 75.8768;

      const pLat = requestData.patient_lat || jeccLat;
      const pLng = requestData.patient_long || jeccLng;

      // If we get 0,0 or bad values, use JECC
      const finalLat = (pLat < 20) ? jeccLat : pLat;
      const finalLng = (pLng < 70) ? jeccLng : pLng;

      // Handle Allergies: DB Text -> String Array
      let allergyArray: string[] = [];
      if (medicalProfile?.allergies) {
        // If it's a comma-separated string, split it, else wrap single string
        allergyArray = medicalProfile.allergies.includes(',')
          ? medicalProfile.allergies.split(',').map((s: string) => s.trim())
          : [medicalProfile.allergies];
      }

      // Fetch User Name if requestData name is generic or missing, and we have a user_id
      let finalName = requestData.patient_name || 'Unknown Patient';
      if ((!finalName || finalName === 'Unknown Patient') && requestData.user_id) {
        const { data: userData } = await supabase
          .from('users' as any)
          .select('name, username')
          .eq('id', requestData.user_id)
          .maybeSingle();
        if (userData) {
          finalName = userData.name || userData.username || finalName;
        }
      }

      // Age Extraction Logic
      let finalAge = medicalProfile?.age;

      // Fallback: Check if Age is hidden in the text if DB column was empty
      if (!finalAge || finalAge === 0) {
        const ageMatch = medicalProfile?.important_medical_info?.match(/\[Age: (\d+)\]/);
        if (ageMatch) {
          finalAge = parseInt(ageMatch[1]);
        }
      }

      // Clean the text for display (remove the [Age: XX] part)
      let finalImportantInfo = medicalProfile?.important_medical_info || '';
      finalImportantInfo = finalImportantInfo.replace(/\[Age: \d+\]\s*/, '');

      const newAlert: EmergencyAlert = {
        id: requestData.id,
        emergencyType: requestData.emergency_type || 'other',
        severity: 'critical',
        patient: {
          id: requestData.user_id || `pat-${Date.now()}`,
          name: finalName,
          age: finalAge,
          gender: 'other',
          emergencyContact: requestData.patient_phone,
          bloodGroup: medicalProfile?.blood_group || 'Unknown',
          allergies: allergyArray,
          conditions: medicalProfile?.medical_conditions,
          importantInfo: finalImportantInfo
        },
        ambulance: {
          id: 'amb-live',
          vehicleNumber: 'RJ-14-EA-1234',
          driverName: 'Manish Kumar',
          paramedicName: 'TBD',
          contactNumber: requestData.patient_phone || '',
          currentLocation: {
            lat: finalLat,
            lng: finalLng
          },
          status: 'en_route'
        },
        eta: 15,
        createdAt: new Date(requestData.created_at),
        description: `Incoming ${requestData.emergency_type} - from JECC`,
        status: 'incoming'
      };

      setEmergencies(prev => {
        // Strict ID check to prevent duplicates
        if (prev.some(e => e.id === newAlert.id)) return prev;
        return [newAlert, ...prev];
      });

      // Show toast if recent (last 5 mins)
      const isRecent = (new Date().getTime() - new Date(requestData.created_at).getTime()) < 5 * 60 * 1000;
      if (isRecent) {
        toast({
          title: "🚨 INCOMING EMERGENCY!",
          description: `${requestData.patient_name || 'Patient'} is en route from JECC.`,
          variant: "destructive",
          duration: 5000
        });
      }
    } catch (e) {
      console.error("Error processing incoming request:", e);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initDashboard = async () => {
      try {
        setEmergencies([]);

        // 1. Fetch active emergencies
        const { data, error } = await supabase
          .from('emergency_requests' as any)
          .select('*')
          .eq('assigned_hospital_id', HOSPITAL_ID)
          .eq('status', 'hospital_assigned')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (mounted && data && data.length > 0) {
          // Filter: Only show emergencies from the last 1 hour to prevent clutter
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

          const recentData = data.filter((req: any) => {
            const reqDate = new Date(req.created_at);
            return reqDate > oneHourAgo;
          });

          // If we filtered everything out, fine. If not, only show top 3.
          for (const req of recentData.slice(0, 3)) {
            await processIncomingRequest(req);
          }
        }
      } catch (e) {
        console.error("Critical error during dashboard initialization:", e);
      }
    };

    initDashboard();

    // 2. Listen for new assignments
    const channel = supabase
      .channel('hospital-dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'emergency_requests',
          filter: `assigned_hospital_id=eq.${HOSPITAL_ID}`
        },
        async (payload) => {
          if (!mounted) return;
          try {
            const newData = payload.new as any;
            if (newData.status === 'hospital_assigned') {
              await processIncomingRequest(newData);
            }
          } catch (e) {
            console.error("Error handling real-time update:", e);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateEmergency = (updates: Partial<EmergencyAlert>) => {
    if (!selectedEmergency) return;
    const updated = { ...selectedEmergency, ...updates };
    setEmergencies(prev => prev.map(e => e.id === updated.id ? updated : e));
    setSelectedEmergency(updated);
  };

  const handleConfirmArrival = () => { handleUpdateEmergency({ status: 'arrived' }); };
  const handleUpdateAdmission = () => { handleUpdateEmergency({ status: 'admitted' }); };

  if (selectedEmergency) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader
          hospital={MGH_DATA}
          alertCount={incomingEmergencies.length}
          onLogout={onLogout}
        />
        <main className="container px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedEmergency(null)}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ErrorBoundary>
                <PatientProfile emergency={selectedEmergency} />
              </ErrorBoundary>
              <ErrorBoundary>
                <AmbulanceTracker emergency={selectedEmergency} />
              </ErrorBoundary>
            </div>

            <div className="space-y-6">
              <ArrivalPanel
                emergency={selectedEmergency}
                onConfirmArrival={handleConfirmArrival}
                onUpdateAdmission={handleUpdateAdmission}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        hospital={MGH_DATA}
        alertCount={incomingEmergencies.length}
        onLogout={onLogout}
      />

      <main className="container px-4 py-6 space-y-6">
        <StatsPanel
          hospital={MGH_DATA}
          activeEmergencies={emergencies.length}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-secondary/50">
            <TabsTrigger value="incoming" className="gap-2 data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Incoming
              {incomingEmergencies.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-destructive text-destructive-foreground">
                  {incomingEmergencies.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger value="arrived" className="gap-2 data-[state=active]:bg-success/20 data-[state=active]:text-success">
              <CheckCircle className="h-4 w-4" />
              Arrived
              {arrivedEmergencies.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-success text-foreground">
                  {arrivedEmergencies.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="aadhaar" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <CreditCard className="h-4 w-4" />
              Aadhaar Lookup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incoming" className="space-y-4 animate-fade-in">
            {incomingEmergencies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No incoming emergencies</p>
              </div>
            ) : (
              incomingEmergencies.map((emergency, index) => (
                <div
                  key={emergency.id}
                  className="animate-slide-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <EmergencyCard
                    emergency={emergency}
                    onViewDetails={handleViewDetails}
                  />
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="arrived" className="space-y-4 animate-fade-in">
            {arrivedEmergencies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No arrived patients</p>
              </div>
            ) : (
              arrivedEmergencies.map((emergency, index) => (
                <div
                  key={emergency.id}
                  className="animate-slide-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <EmergencyCard
                    emergency={emergency}
                    onViewDetails={handleViewDetails}
                  />
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="aadhaar" className="animate-fade-in">
            <AbhaLookup />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
