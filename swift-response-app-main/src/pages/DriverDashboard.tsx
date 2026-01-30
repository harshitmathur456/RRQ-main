import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriver } from '@/contexts/DriverContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/driver/StatusBadge';
import MapPreview from '@/components/driver/MapPreview';
import {
  Ambulance,
  Power,
  LogOut,
  Phone,
  Clock,
  MapPin,
  AlertTriangle,
  Siren,
  Navigation,
  Building2,
  Locate,
  Search
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmergencyRequest {
  id: string;
  patient_name: string;
  emergency_type: string;
  patient_lat: number;
  patient_long: number;
  patient_phone: string;
}

// Updated Coordinates for JECC based on search (Sitapura)
const JECC_LOCATION = { lat: 26.7828, lng: 75.8270 };

const RECOMMENDED_HOSPITALS = [
  {
    id: 'hosp-001',
    name: 'Mahatma Gandhi Hospital (MGH)',
    specialty: 'Trauma & Advanced Care',
    distance: '0.8 km',
    eta: '3 mins',
    location: { lat: 26.7690, lng: 75.8550 }
  },
  {
    id: 'hosp-002',
    name: 'Bombay Hospital Jaipur',
    specialty: 'Multi-Specialty',
    distance: '1.6 km',
    eta: '5 mins',
    location: { lat: 26.7850, lng: 75.8600 }
  },
  {
    id: 'hosp-003',
    name: 'Narayana Multispeciality Hospital',
    specialty: 'Cardiac & Critical Care',
    distance: '4.2 km',
    eta: '9 mins',
    location: { lat: 26.8080, lng: 75.8350 }
  },
  {
    id: 'hosp-004',
    name: 'RUHS College of Medical Sciences',
    specialty: 'Government/General',
    distance: '4.5 km',
    eta: '11 mins',
    location: { lat: 26.8100, lng: 75.8400 }
  },
  {
    id: 'hosp-005',
    name: 'Jeevan Rekha Superspeciality',
    specialty: 'Emergency',
    distance: '5.1 km',
    eta: '13 mins',
    location: { lat: 26.8150, lng: 75.8200 }
  }
];

const DriverDashboard: React.FC = () => {
  const {
    driver,
    isLoggedIn,
    isOnline,
    toggleOnline,
    logout
  } = useDriver();
  const navigate = useNavigate();

  const [incomingAlert, setIncomingAlert] = useState<EmergencyRequest | null>(null);
  const [activeJob, setActiveJob] = useState<EmergencyRequest | null>(null);
  const [jobStage, setJobStage] = useState<'idle' | 'accepted' | 'hospital_selection' | 'transporting'>('idle');
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  // Location Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/');
      return;
    }
  }, [isLoggedIn, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Real-time Subscription
  useEffect(() => {
    if (!isOnline) return;

    const channel = supabase
      .channel('emergency_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emergency_requests', filter: 'status=eq.pending' },
        (payload) => {
          console.log('New Emergency Alert!', payload);
          setIncomingAlert(payload.new as EmergencyRequest);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline]);

  const initiateAccept = () => {
    setIsLocationModalOpen(true);
  };

  const handleUseGPS = () => {
    if ("geolocation" in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsLocating(false);
          setDriverLocation([position.coords.longitude, position.coords.latitude]);
          confirmAccept([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          setIsLocating(false);
          console.error("GPS Error", error);
          toast.error("Could not fetch GPS. Try manual entry.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toast.error("Geolocation not supported");
    }
  };

  const handleManualEntry = async () => {
    if (!manualAddress) return;
    setIsGeocoding(true);

    // Hardcoded Fallback for Demo
    if (manualAddress.toLowerCase().includes('jecrc') || manualAddress.toLowerCase().includes('sitapura')) {
      setTimeout(() => {
        confirmAccept([75.8122, 26.7905]); // JECRC Coordinates
        setIsGeocoding(false);
      }, 1000);
      return;
    }

    try {
      const API_KEY = "k1zvEY6H4bQdKo7kYXdpT0rJFVXbotHKDPKcGhxH";
      const response = await fetch(
        `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(manualAddress)}&api_key=${API_KEY}`
      );
      const data = await response.json();

      if (data?.geocodingResults?.[0]?.geometry?.location) {
        const { lat, lng } = data.geocodingResults[0].geometry.location;
        confirmAccept([lng, lat]);
      } else {
        toast.error("Address not found. Try 'JECRC' for demo.");
      }
    } catch (error) {
      console.error("Geocoding failed", error);
      toast.error("Failed to find location. Try 'JECRC'.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const confirmAccept = (location: [number, number]) => {
    setDriverLocation(location);
    setIsLocationModalOpen(false);

    if (incomingAlert) {
      setActiveJob(incomingAlert);
      setIncomingAlert(null);
      setJobStage('accepted');
      toast.success("Emergency Accepted! Routing...");
    }
  };

  const handleStartTransport = async () => {
    if (!activeJob || !selectedHospitalId) return;

    try {
      // 1. Update Supabase
      const { error } = await supabase
        .from('emergency_requests' as any)
        .update({
          assigned_hospital_id: selectedHospitalId,
          status: 'hospital_assigned'
        } as any)
        .eq('id', activeJob.id);

      if (error) throw error;

      // 2. Advance State
      setJobStage('transporting');
      toast.success("Navigation Started - Heading to Hospital!");

    } catch (error) {
      console.error("Error updating hospital", error);
      toast.error("Failed to notify hospital");
    }
  };

  const getSelectedHospital = () => RECOMMENDED_HOSPITALS.find(h => h.id === selectedHospitalId);

  if (!driver) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Location Selection Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-2xl p-6 border border-border shadow-2xl space-y-6">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-primary mx-auto mb-2" />
              <h2 className="text-xl font-bold">Set Ambulance Starting Point</h2>
              <p className="text-muted-foreground">We need your location to calculate the fastest route.</p>
            </div>

            <div className="grid gap-4">
              <Button size="lg" className="gap-2 h-14 text-lg" onClick={handleUseGPS} disabled={isLocating}>
                {isLocating ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Locate className="w-5 h-5" />}
                {isLocating ? "Locating..." : "Use GPS Location"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or enter manually</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Current Address / Landmark</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Malviya Nagar, Jaipur"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                  />
                  <Button size="icon" onClick={handleManualEntry} disabled={isGeocoding}>
                    {isGeocoding ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <Button variant="ghost" className="w-full" onClick={() => setIsLocationModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Alert Value Overlay */}
      {incomingAlert && !isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in zoom-in">
          <div className="bg-card w-full max-w-sm rounded-3xl p-6 border-2 border-emergency shadow-2xl space-y-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-20 h-20 bg-emergency/20 rounded-full flex items-center justify-center animate-pulse">
                <Siren className="w-10 h-10 text-emergency" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">NEW EMERGENCY</h2>
              <p className="text-lg font-medium text-emergency uppercase tracking-wider">{incomingAlert.emergency_type}</p>
            </div>

            <div className="space-y-4 bg-muted/50 p-4 rounded-xl">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient:</span>
                <span className="font-semibold">{incomingAlert.patient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contact:</span>
                <span className="font-semibold">{incomingAlert.patient_phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-semibold">JECC Sitapura (Venue)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" size="lg" onClick={() => setIncomingAlert(null)}>
                Ignore
              </Button>
              <Button variant="emergency" size="lg" onClick={initiateAccept}>
                ACCEPT
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emergency/20 rounded-full flex items-center justify-center">
              <Ambulance className="w-5 h-5 text-emergency" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">{driver.name}</h1>
              <p className="text-xs text-muted-foreground">{driver.vehicleNumber}</p>
            </div>
          </div>
          <StatusBadge isOnline={isOnline} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-6">

        {jobStage === 'accepted' ? (
          <div className="space-y-6 animate-in slide-in-from-bottom h-[calc(100vh-140px)] flex flex-col">
            {/* Real Map View */}
            <div className="flex-1 w-full bg-muted rounded-2xl relative overflow-hidden border-2 border-primary/20">
              {activeJob && (
                <MapPreview
                  pickupAddress="JECC Sitapura"
                  // Force Pickup to JECC
                  overridePickupLocation={[JECC_LOCATION.lng, JECC_LOCATION.lat]}
                  overrideDriverLocation={driverLocation}
                  showRoute={true}
                  className="h-full w-full"
                />
              )}
            </div>

            <Button
              size="xl"
              className="w-full text-lg shadow-lg mt-4"
              onClick={() => setJobStage('hospital_selection')}
            >
              Patient Picked Up - Select Hospital
            </Button>
          </div>
        ) : jobStage === 'transporting' && selectedHospitalId ? (
          <div className="space-y-6 animate-in slide-in-from-bottom h-[calc(100vh-140px)] flex flex-col">
            {/* Map View: JECC -> Hospital */}
            <div className="bg-card p-4 rounded-xl border border-border shadow-sm mb-2">
              <h2 className="font-bold text-lg text-primary flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Routing to Hospital
              </h2>
              <p className="text-muted-foreground">{getSelectedHospital()?.name}</p>
            </div>

            <div className="flex-1 w-full bg-muted rounded-2xl relative overflow-hidden border-2 border-primary/20">
              <MapPreview
                pickupAddress="JECC Jaipur"
                // Origin: JECC (Previous pickup point)
                overrideDriverLocation={[JECC_LOCATION.lng, JECC_LOCATION.lat]}
                // Destination: Hospital
                overridePickupLocation={[getSelectedHospital()!.location.lng, getSelectedHospital()!.location.lat]}
                showRoute={true}
                className="h-full w-full"
              />
            </div>

            <Button size="xl" variant="outline" className="w-full mt-4" onClick={() => {
              setJobStage('idle');
              setDriverLocation(null);
              setActiveJob(null);
              setIncomingAlert(null);
              setSelectedHospitalId(null);
            }}>
              Complete Transport
            </Button>
          </div>
        ) : jobStage === 'hospital_selection' ? (
          <div className="space-y-6 animate-in slide-in-from-right h-[calc(100vh-100px)] flex flex-col">
            <div className="text-center space-y-2 shrink-0">
              <Building2 className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold">Select Destination Hospital</h2>
              <p className="text-sm text-muted-foreground">Recommended facilities near JECC</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {RECOMMENDED_HOSPITALS.map((hosp) => (
                <button
                  key={hosp.id}
                  onClick={() => setSelectedHospitalId(hosp.id)}
                  className={`w-full flex items-center justify-between p-4 bg-card border rounded-xl transition-all text-left group
                     ${selectedHospitalId === hosp.id ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/50'}`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className={`font-semibold truncate ${selectedHospitalId === hosp.id ? 'text-primary' : ''}`}>
                      {hosp.name}
                    </p>
                    <p className="text-xs text-muted-foreground mb-1">{hosp.specialty}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded text-foreground font-medium">
                        <Navigation className="w-3 h-3" /> {hosp.distance}
                      </span>
                      <span className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded text-foreground font-medium">
                        <Clock className="w-3 h-3" /> {hosp.eta}
                      </span>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                        ${selectedHospitalId === hosp.id ? 'border-primary bg-primary text-white' : 'border-muted-foreground/30'}`}>
                    {selectedHospitalId === hosp.id && <div className="w-2.5 h-2.5 bg-current rounded-full" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="shrink-0 pt-2">
              <Button
                size="xl"
                className="w-full shadow-lg text-lg gap-2"
                disabled={!selectedHospitalId}
                onClick={handleStartTransport}
              >
                <Navigation className="w-5 h-5" />
                Start Navigation
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Status Card */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-card slide-up">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Availability Status</h2>
                  <p className="text-sm text-muted-foreground">
                    {isOnline ? 'You are receiving emergency alerts' : 'Go online to receive alerts'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${isOnline ? 'bg-success/20' : 'bg-muted'}`}>
                  <Power className={`w-6 h-6 ${isOnline ? 'text-success' : 'text-muted-foreground'}`} />
                </div>
              </div>

              <div
                className="flex items-center justify-between p-4 bg-secondary rounded-xl cursor-pointer"
                onClick={toggleOnline}
              >
                <span className="font-medium text-foreground">
                  {isOnline ? 'Online - Receiving Alerts' : 'Offline - Not Receiving Alerts'}
                </span>
                <Switch checked={isOnline} onCheckedChange={toggleOnline} />
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-card slide-up" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-lg font-semibold text-foreground mb-4">Vehicle Information</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                    <Ambulance className="w-5 h-5 text-emergency" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle Number</p>
                    <p className="font-medium text-foreground">{driver.vehicleNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle Type</p>
                    <p className="font-medium text-foreground">{driver.vehicleType}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-card slide-up" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" className="h-auto py-4 flex-col gap-2">
                  <Phone className="w-5 h-5" />
                  <span className="text-sm">Call Dispatch</span>
                </Button>
                <Button variant="secondary" className="h-auto py-4 flex-col gap-2">
                  <MapPin className="w-5 h-5" />
                  <span className="text-sm">My Location</span>
                </Button>
                <Button variant="secondary" className="h-auto py-4 flex-col gap-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm">Shift Info</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm">Log Out</span>
                </Button>
              </div>
            </div>

            {/* Waiting Message */}
            {isOnline && (
              <div className="text-center py-8 fade-in">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 emergency-pulse">
                  <Ambulance className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Waiting for incoming emergency...</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default DriverDashboard;
