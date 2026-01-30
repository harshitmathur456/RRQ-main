import React, { createContext, useContext, useState, useCallback } from 'react';
import { Driver, EmergencyRequest, Trip, TripStatus } from '@/types/driver';

interface DriverContextType {
  driver: Driver | null;
  isLoggedIn: boolean;
  isOnline: boolean;
  currentEmergency: EmergencyRequest | null;
  currentTrip: Trip | null;
  login: (driverId: string, phone: string) => void;
  logout: () => void;
  toggleOnline: () => void;
  setCurrentEmergency: (emergency: EmergencyRequest | null) => void;
  acceptEmergency: () => void;
  rejectEmergency: () => void;
  updateTripStatus: (status: TripStatus) => void;
  completeTrip: () => void;
  updateEmergencyHospital: (name: string, address: string, coords: { lat: number, lng: number }) => void;
}

const DriverContext = createContext<DriverContextType | undefined>(undefined);

export const useDriver = () => {
  const context = useContext(DriverContext);
  if (!context) {
    throw new Error('useDriver must be used within a DriverProvider');
  }
  return context;
};

// Mock emergency for demo
const mockEmergency: EmergencyRequest = {
  id: 'EMR-001',
  type: 'cardiac',
  patientName: 'John Doe',
  patientPhone: '+1 555-0123',
  pickupAddress: 'JECRC jaipur',
  pickupCoordinates: { lat: 26.7749, lng: 75.8277 },
  hospitalName: 'City General Hospital',
  hospitalAddress: '456 Hospital Ave, City 12345',
  emergencyInfo: 'Patient experiencing chest pain and difficulty breathing. Age: 58',
  createdAt: new Date(),
  estimatedDistance: '3.2 km',
  estimatedTime: '8 min',
};

export const DriverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [currentEmergency, setCurrentEmergency] = useState<EmergencyRequest | null>(null);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);

  const login = useCallback((driverId: string, phone: string) => {
    setDriver({
      id: driverId,
      name: 'Driver ' + driverId,
      phone,
      vehicleNumber: 'AMB-' + driverId.slice(-4).toUpperCase(),
      vehicleType: 'Advanced Life Support',
      isOnline: false,
    });
  }, []);

  const logout = useCallback(() => {
    setDriver(null);
    setIsOnline(false);
    setCurrentEmergency(null);
    setCurrentTrip(null);
  }, []);

  const toggleOnline = useCallback(() => {
    setIsOnline(prev => {
      const newState = !prev;
      // Simulate incoming emergency when going online
      if (newState && !currentEmergency && !currentTrip) {
        setTimeout(() => {
          setCurrentEmergency(mockEmergency);
        }, 2000);
      }
      return newState;
    });
  }, [currentEmergency, currentTrip]);

  const acceptEmergency = useCallback(() => {
    if (currentEmergency && driver) {
      setCurrentTrip({
        id: 'TRIP-' + Date.now(),
        emergency: currentEmergency,
        driver,
        status: 'accepted',
        acceptedAt: new Date(),
      });
      setCurrentEmergency(null);
    }
  }, [currentEmergency, driver]);

  const rejectEmergency = useCallback(() => {
    setCurrentEmergency(null);
  }, []);

  const updateTripStatus = useCallback((status: TripStatus) => {
    setCurrentTrip(prev => {
      if (!prev) return prev;
      const updates: Partial<Trip> = { status };

      switch (status) {
        case 'arrived_pickup':
          updates.arrivedPickupAt = new Date();
          break;
        case 'transporting':
          updates.startedTransportAt = new Date();
          break;
        case 'reached_hospital':
          updates.completedAt = new Date();
          break;
      }

      return { ...prev, ...updates };
    });
  }, []);

  const completeTrip = useCallback(() => {
    setCurrentTrip(null);
  }, []);

  return (
    <DriverContext.Provider
      value={{
        driver,
        isLoggedIn: !!driver,
        isOnline,
        currentEmergency,
        currentTrip,
        login,
        logout,
        toggleOnline,
        setCurrentEmergency,
        acceptEmergency,
        rejectEmergency,
        updateTripStatus,
        completeTrip,
        updateEmergencyHospital: (name: string, address: string, coords: { lat: number, lng: number }) => {
          if (currentTrip && currentTrip.emergency) {
            setCurrentTrip(prev => {
              if (!prev) return null;
              return {
                ...prev,
                emergency: {
                  ...prev.emergency,
                  hospitalName: name,
                  hospitalAddress: address,
                  hospitalCoordinates: coords // We need to add this field to EmergencyRequest type first potentially, or just manage it here
                }
              };
            });
          }
        }
      }}
    >
      {children}
    </DriverContext.Provider>
  );
};
