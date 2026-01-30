import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriver } from '@/contexts/DriverContext';
import { Button } from '@/components/ui/button';
import MapPreview from '@/components/driver/MapPreview';
import EmergencyTypeBadge from '@/components/driver/EmergencyTypeBadge';
import { TripStatus, STATUS_LABELS } from '@/types/driver';
import {
  MapPin,
  Clock,
  Navigation,
  Phone,
  Hospital,
  CheckCircle2,
  ArrowRight,
  Ambulance
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STATUS_FLOW: TripStatus[] = [
  'accepted',
  'on_the_way',
  'arrived_pickup',
  'transporting',
  'reached_hospital',
];

const DispatchDetails: React.FC = () => {
  const {
    currentTrip,
    isLoggedIn,
    updateTripStatus,
    completeTrip,
    updateEmergencyHospital
  } = useDriver();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isNavigating, setIsNavigating] = useState(false);

  // Hospital Selection State
  const [showHospitalSelection, setShowHospitalSelection] = useState(false);
  const [nearbyHospitals, setNearbyHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<any>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/');
      return;
    }
    if (!currentTrip) {
      navigate('/dashboard');
    }
  }, [isLoggedIn, currentTrip, navigate]);

  const handleStartNavigation = () => {
    setIsNavigating(true);
    toast({
      title: 'Navigation Started',
      description: 'Follow the route to the destination.',
    });
    updateTripStatus('on_the_way');
  };

  const fetchNearbyHospitals = async () => {
    // Mock API - In real app, use Ola Maps Places API
    // const response = await fetch(`https://api.olamaps.io/places/v1/nearbysearch?location=${lat},${lng}&types=hospital&api_key=${API_KEY}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
    return [
      {
        id: 'h1',
        name: 'Eternal Multispeciality Hospital',
        address: '3 A Jagatpura Road, Near Jawahar Circle, Jaipur',
        location: { lat: 26.8526, lng: 75.8118 },
        distance: '2.5 km',
        time: '8 min'
      },
      {
        id: 'h2',
        name: 'Fortis Escorts Hospital',
        address: 'Jawahar Lal Nehru Marg, Malviya Nagar, Jaipur',
        location: { lat: 26.8647, lng: 75.8055 },
        distance: '3.8 km',
        time: '12 min'
      },
      {
        id: 'h3',
        name: 'Mahatma Gandhi Hospital',
        address: 'RIICO Institutional Area, Sitapura, Jaipur',
        location: { lat: 26.7766, lng: 75.8576 },
        distance: '5.1 km',
        time: '14 min'
      },
      {
        id: 'h4',
        name: 'Apex Hospitals',
        address: 'Malviya Nagar, Jaipur',
        location: { lat: 26.8557, lng: 75.8164 },
        distance: '3.0 km',
        time: '10 min'
      },
      {
        id: 'h5',
        name: 'Narayana Multispeciality Hospital',
        address: 'Kumbha Marg, Sector 28, Sanganer, Jaipur',
        location: { lat: 26.7905, lng: 75.8122 },
        distance: '4.2 km',
        time: '13 min'
      }
    ];
  };

  const handleStatusUpdate = async () => {
    if (!currentTrip) return;

    const currentIndex = STATUS_FLOW.indexOf(currentTrip.status);
    const nextStatus = STATUS_FLOW[currentIndex + 1];

    // Special handling for 'transporting' phase (after picking up patient)
    if (nextStatus === 'transporting') {
      const hospitals = await fetchNearbyHospitals();
      setNearbyHospitals(hospitals);
      setShowHospitalSelection(true);
      return;
    }

    if (nextStatus) {
      if (nextStatus === 'reached_hospital') {
        setIsNavigating(false);
      }

      updateTripStatus(nextStatus);
      toast({
        title: 'Status Updated',
        description: STATUS_LABELS[nextStatus],
      });

      if (nextStatus === 'reached_hospital') {
        setTimeout(() => {
          navigate('/complete');
        }, 500);
      }
    }
  };

  const confirmHospitalSelection = () => {
    if (selectedHospital && updateEmergencyHospital) {
      updateEmergencyHospital(
        selectedHospital.name,
        selectedHospital.address,
        selectedHospital.location
      );

      toast({
        title: 'Destination Set',
        description: `Routing to ${selectedHospital.name}`,
      });

      setShowHospitalSelection(false);
      updateTripStatus('transporting');
      // Re-enable navigation for the new route
      setIsNavigating(true);
    }
  };

  const getNextStatusLabel = (): string => {
    if (!currentTrip) return '';
    const currentIndex = STATUS_FLOW.indexOf(currentTrip.status);
    const nextStatus = STATUS_FLOW[currentIndex + 1];

    switch (nextStatus) {
      case 'on_the_way': return 'Start Navigation';
      case 'arrived_pickup': return 'Arrived at Pickup';
      case 'transporting': return 'Start Transport';
      case 'reached_hospital': return 'Reached Hospital';
      default: return '';
    }
  };

  const getStatusIcon = (status: TripStatus, currentStatus: TripStatus) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    const statusIndex = STATUS_FLOW.indexOf(status);

    if (statusIndex < currentIndex) {
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    } else if (statusIndex === currentIndex) {
      return <div className="w-5 h-5 rounded-full bg-emergency status-pulse" />;
    }
    return <div className="w-5 h-5 rounded-full bg-muted" />;
  };

  if (!currentTrip) return null;

  const { emergency } = currentTrip;

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Hospital Selection Overlay */}
      {showHospitalSelection && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm p-4 flex flex-col slide-up">
          <h3 className="font-bold text-lg mb-4">Select Destination Hospital</h3>
          <p className="text-sm text-muted-foreground mb-4">Select the most appropriate hospital for the patient.</p>

          <div className="flex-1 overflow-y-auto space-y-3">
            {nearbyHospitals.map(h => (
              <div
                key={h.id}
                onClick={() => setSelectedHospital(h)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedHospital?.id === h.id
                  ? 'border-emergency bg-emergency/10 ring-2 ring-emergency/20'
                  : 'border-border bg-card hover:border-emergency/50'
                  }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{h.name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">{h.address}</p>
                  </div>
                  <div className="text-xs text-right bg-background/50 px-2 py-1 rounded">
                    <p className="font-bold">{h.time}</p>
                    <p className="text-muted-foreground">{h.distance}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t">
            <Button
              variant="emergency"
              size="full"
              disabled={!selectedHospital}
              onClick={confirmHospitalSelection}
            >
              Confirm Destination <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="full"
              className="mt-2"
              onClick={() => setShowHospitalSelection(false)}
            >
              Cancel
            </Button>
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
              <p className="text-xs text-muted-foreground">Trip ID</p>
              <p className="font-semibold text-foreground">{currentTrip.id}</p>
            </div>
          </div>
          <EmergencyTypeBadge type={emergency.type} size="sm" />
        </div>
      </header>

      {/* Map */}
      <div className="relative">
        <MapPreview
          pickupAddress={emergency.pickupAddress}
          hospitalAddress={emergency.hospitalAddress}
          hospitalCoordinates={emergency.hospitalCoordinates}
          showRoute={isNavigating}
          className="h-[50vh] min-h-[350px]"
        />

      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Status Progress */}
        <div className="bg-card rounded-xl p-4 border border-border shadow-card slide-up">
          <h3 className="font-semibold text-foreground mb-4">Trip Status</h3>
          <div className="space-y-3">
            {STATUS_FLOW.map((status, index) => (
              <div key={status} className="flex items-center gap-3">
                {getStatusIcon(status, currentTrip.status)}
                <span className={`text-sm ${STATUS_FLOW.indexOf(currentTrip.status) >= index
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground'
                  }`}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pickup Location */}
        <div className="bg-card rounded-xl p-4 border border-border shadow-card slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emergency/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-emergency" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Pickup Location</p>
              <p className="font-medium text-foreground">{emergency.pickupAddress}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Navigation className="w-4 h-4" />
                  {emergency.estimatedDistance}
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {emergency.estimatedTime}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Hospital */}
        {emergency.hospitalName && (
          <div className="bg-card rounded-xl p-4 border border-border shadow-card slide-up" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Hospital className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Destination Hospital</p>
                <p className="font-medium text-foreground">{emergency.hospitalName}</p>
                <p className="text-sm text-muted-foreground">{emergency.hospitalAddress}</p>
              </div>
            </div>
          </div>
        )}

        {/* Emergency Info */}
        {emergency.emergencyInfo && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 slide-up" style={{ animationDelay: '0.2s' }}>
            <p className="text-sm font-medium text-warning mb-1">Patient Information</p>
            <p className="text-foreground text-sm">{emergency.emergencyInfo}</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 slide-up" style={{ animationDelay: '0.25s' }}>
          <Button variant="secondary" className="h-14">
            <Phone className="w-5 h-5 mr-2" />
            Call Dispatch
          </Button>
          {emergency.patientPhone && (
            <Button variant="secondary" className="h-14">
              <Phone className="w-5 h-5 mr-2" />
              Call Patient
            </Button>
          )}
        </div>
      </main>

      {/* Action Button */}
      <div className="p-4 bg-card border-t border-border">
        {currentTrip.status === 'accepted' ? (
          <Button
            variant="emergency"
            size="full"
            onClick={handleStartNavigation}
            className="gap-3"
          >
            <Navigation className="w-6 h-6" />
            Start Navigation
          </Button>
        ) : currentTrip.status !== 'reached_hospital' ? (
          <Button
            variant="success"
            size="full"
            onClick={handleStatusUpdate}
            className="gap-3"
          >
            {getNextStatusLabel()}
            <ArrowRight className="w-5 h-5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default DispatchDetails;
