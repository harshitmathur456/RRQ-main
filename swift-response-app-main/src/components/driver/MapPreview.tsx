import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Clock, Ruler, Hospital } from 'lucide-react';
import { cn } from '@/lib/utils';
import maplibregl from 'maplibre-gl';

declare global {
  interface Window {
    OlaMaps: any;
  }
}

interface MapPreviewProps {
  pickupAddress: string;
  hospitalAddress?: string;
  hospitalCoordinates?: { lat: number; lng: number };
  showRoute?: boolean;
  className?: string;
  overrideDriverLocation?: [number, number] | null;
  overridePickupLocation?: [number, number] | null;
}

const MapPreview: React.FC<MapPreviewProps> = ({
  pickupAddress,
  hospitalAddress,
  hospitalCoordinates,
  showRoute = false,
  className,
  overrideDriverLocation,
  overridePickupLocation
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const olaMapsRef = useRef<any>(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(overrideDriverLocation || null);
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(overridePickupLocation || null);
  const [routeMetrics, setRouteMetrics] = useState<{ distance: string; duration: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_KEY = "k1zvEY6H4bQdKo7kYXdpT0rJFVXbotHKDPKcGhxH";

  // 1. Get Driver Location (if not overridden)
  useEffect(() => {
    if (overrideDriverLocation) {
      setDriverLocation(overrideDriverLocation);
    } else if (!("geolocation" in navigator)) {
      setDriverLocation([75.7873, 26.9124]);
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverLocation([position.coords.longitude, position.coords.latitude]);
        },
        (err) => {
          console.error("Error getting location:", err);
          setDriverLocation([75.7873, 26.9124]);
        }
      );
    }
  }, [overrideDriverLocation]);

  // 2. Geocode Pickup (if not overridden)
  useEffect(() => {
    if (overridePickupLocation) {
      setPickupCoords(overridePickupLocation);
      return;
    }

    const fetchCoordinates = async () => {
      if (!pickupAddress || !API_KEY) return;

      try {
        const response = await fetch(
          `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(pickupAddress)}&api_key=${API_KEY}`
        );
        const data = await response.json();

        if (data?.geocodingResults?.[0]?.geometry?.location) {
          const { lat, lng } = data.geocodingResults[0].geometry.location;
          setPickupCoords([lng, lat]);
        } else {
          if (pickupAddress.toLowerCase().includes('jecrc')) {
            setPickupCoords([75.8122, 26.7905]);
          }
        }
      } catch (err) {
        console.error("Geocoding failed:", err);
        if (pickupAddress.toLowerCase().includes('jecrc')) {
          setPickupCoords([75.8122, 26.7905]);
        }
      }
    };

    fetchCoordinates();
  }, [pickupAddress, API_KEY]);

  // 3. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || !window.OlaMaps) return;
    if (mapInstanceRef.current) return;

    try {
      const olaMaps = new window.OlaMaps({
        apiKey: API_KEY,
      });

      olaMapsRef.current = olaMaps;

      const myMap = olaMaps.init({
        style: "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json",
        container: mapContainerRef.current,
        center: driverLocation || [75.7873, 26.9124],
        zoom: 12,
      });

      mapInstanceRef.current = myMap;

      if (olaMaps.create && myMap.addControl) {
        const navigationControl = olaMaps.create('navigationControl', {
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        });
        myMap.addControl(navigationControl);
      }

    } catch (e) {
      console.error("Map Init Error:", e);
      setError("Map Error");
    }
  }, [driverLocation, API_KEY]);

  // 4. Update Markers & Route
  useEffect(() => {
    if (!mapInstanceRef.current || !olaMapsRef.current) return;
    if (!driverLocation || !pickupCoords) return;

    const map = mapInstanceRef.current;
    const olaMaps = olaMapsRef.current;

    const updateMap = async () => {
      try {
        // Determine Routing Points:
        // Use hospitalCoordinates AND showRoute to detect "Transporting" phase.
        // If just hospitalCoordinates exist but showRoute is false, might be viewing details, but usually showRoute=true for active nav.

        const isTransporting = !!hospitalCoordinates;

        // Per requirement: "map should show shortest route between eternal hospital and current address"
        // Current address = Driver's real-time location.
        // Destination = Selected Hospital (if transporting) OR Pickup location (if picking up).

        const destination = isTransporting && hospitalCoordinates
          ? [hospitalCoordinates.lng, hospitalCoordinates.lat]
          : pickupCoords;

        // Markers
        if (olaMaps.addMarker) {
          // Driver Marker (Blue)
          olaMaps.addMarker({ offset: [0, -10], anchor: 'bottom', color: 'blue' })
            .setLngLat(driverLocation)
            .addTo(map);

          // Destination Marker (Red)
          olaMaps.addMarker({ offset: [0, -10], anchor: 'bottom', color: 'red' })
            .setLngLat(destination)
            .addTo(map);
        }

        // Fit Bounds
        if (map.fitBounds) {
          map.fitBounds([
            [Math.min(driverLocation[0], destination[0]), Math.min(driverLocation[1], destination[1])],
            [Math.max(driverLocation[0], destination[0]), Math.max(driverLocation[1], destination[1])]
          ], { padding: 50 });
        }

        // Fetch Route
        if (showRoute) {
          const url = `https://api.olamaps.io/routing/v1/directions?origin=${driverLocation[1]},${driverLocation[0]}&destination=${destination[1]},${destination[0]}&api_key=${API_KEY}`;

          const res = await fetch(url, { method: 'POST' });
          const data = await res.json();

          if (data?.routes?.[0]) {
            const route = data.routes[0];

            if (route.legs && route.legs[0]) {
              setRouteMetrics({
                distance: (route.legs[0].distance / 1000).toFixed(1) + ' km',
                duration: Math.round(route.legs[0].duration / 60) + ' min'
              });
            }

            const geometry = route.overview_polyline || route.geometry;

            if (map.addSource && map.addLayer) {
              if (map.getSource('route')) {
                if (map.getLayer('route')) map.removeLayer('route');
                map.removeSource('route');
              }

              // Decoder logic
              const decodePolyline = (str: string) => {
                let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, 5);
                while (index < str.length) {
                  byte = null; shift = 0; result = 0;
                  do {
                    byte = str.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                  } while (byte >= 0x20);
                  latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
                  shift = result = 0;
                  do {
                    byte = str.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                  } while (byte >= 0x20);
                  longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
                  lat += latitude_change;
                  lng += longitude_change;
                  coordinates.push([lng / factor, lat / factor]);
                }
                return coordinates;
              };

              const coords = typeof geometry === 'string' ? decodePolyline(geometry) : geometry.coordinates;

              map.addSource('route', {
                'type': 'geojson',
                'data': {
                  'type': 'Feature',
                  'properties': {},
                  'geometry': {
                    'type': 'LineString',
                    'coordinates': coords
                  }
                }
              });

              map.addLayer({
                'id': 'route',
                'type': 'line',
                'source': 'route',
                'layout': {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                'paint': {
                  'line-color': '#EF4444',
                  'line-width': 4
                }
              });
            }
          }
        }
      } catch (e) {
        console.error("Map Update Error:", e);
      }
    };

    updateMap();

  }, [driverLocation, pickupCoords, hospitalCoordinates, showRoute, API_KEY]);

  return (
    <div className={cn('relative rounded-xl overflow-hidden bg-secondary', className)}>
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '100%' }} />

      {/* Metrics Overlay */}
      {showRoute && routeMetrics && (
        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-border z-10 pointer-events-none">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-primary" />
              <span className="font-bold text-foreground">{routeMetrics.distance}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-bold text-foreground">{routeMetrics.duration}</span>
            </div>
          </div>
        </div>
      )}

      {/* Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 via-background/80 to-transparent p-4 pointer-events-none">
        <div className="flex items-start gap-3">
          <div className="bg-emergency/20 p-2 rounded-lg">
            {hospitalCoordinates ? <Hospital className="w-4 h-4 text-emergency" /> : <MapPin className="w-4 h-4 text-emergency" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">
              {hospitalCoordinates ? 'Destination Hospital' : 'Pickup Location'}
            </p>
            <p className="text-sm font-medium text-foreground truncate">
              {hospitalCoordinates ? hospitalAddress : pickupAddress}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPreview;
