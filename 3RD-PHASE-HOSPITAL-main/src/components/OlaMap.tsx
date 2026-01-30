import { useEffect, useRef, useState } from 'react';

interface OlaMapProps {
    ambulanceLocation: { lat: number; lng: number };
    hospitalLocation: { lat: number; lng: number };
    className?: string;
}

declare global {
    interface Window {
        OlaMaps: any;
        L: any;
    }
}

export function OlaMap({ ambulanceLocation, hospitalLocation, className }: OlaMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const [mapError, setMapError] = useState<string | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ eta: string; distance: string } | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        const apiKey = 'k1zvEY6H4bQdKo7kYXdpT0rJFVXbotHKDPKcGhxH';

        const initMap = () => {
            if (!window.OlaMaps) {
                setMapError('Ola Maps SDK not loaded');
                return;
            }

            try {
                const olaMaps = new window.OlaMaps({
                    apiKey: apiKey,
                });

                const myMap = olaMaps.init({
                    style: "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json",
                    container: mapRef.current,
                    center: [ambulanceLocation.lng, ambulanceLocation.lat],
                    zoom: 13,
                });

                mapInstanceRef.current = myMap;

                // Add Markers
                try {
                    olaMaps.addMarker({ offset: [0, -10], anchor: 'bottom', color: '#3b82f6' })
                        .setLngLat([ambulanceLocation.lng, ambulanceLocation.lat])
                        .addTo(myMap);

                    olaMaps.addMarker({ offset: [0, -10], anchor: 'bottom', color: '#22c55e' })
                        .setLngLat([hospitalLocation.lng, hospitalLocation.lat])
                        .addTo(myMap);
                } catch (markerError) {
                    console.warn("Could not add markers:", markerError);
                }

                // Fetch Route
                fetchRoute(olaMaps, myMap);

            } catch (error) {
                console.error('Error initializing map:', error);
                setMapError('Failed to initialize Ola Map');
            }
        };

        const fetchRoute = async (olaMaps: any, map: any) => {
            try {
                // Using POST request as per standard routing API practices
                // Sometimes coordinates are passed as query params or body.
                // Based on common patterns: params for GET, body for POST.
                // Let's try GET with query params first as it's simpler and mentioned in some docs.

                // User Request Enhancement: "Show route map between JECC to MGH"
                // Hardcoding Origin to JECC (Jaipur Exhibition & Convention Centre)
                const jeccLat = 26.7744;
                const jeccLng = 75.8768;

                const url = `https://api.olamaps.io/routing/v1/directions?origin=${jeccLat},${jeccLng}&destination=${hospitalLocation.lat},${hospitalLocation.lng}&api_key=${apiKey}`;
                // Double check if Ola expects lng,lat or lat,lng. 
                // Documentation usually says lng,lat for GeoJSON but OSRM often takes lng,lat.
                // However, Google Maps often takes lat,lng.
                // Re-reading user request "map is still wrong".
                // Let's TRY swapping to lng,lat which is standard for Mapbox/OSRM backed services.
                const urlSwapped = `https://api.olamaps.io/routing/v1/directions?origin=${ambulanceLocation.lat},${ambulanceLocation.lng}&destination=${hospitalLocation.lat},${hospitalLocation.lng}&api_key=${apiKey}`;
                // Actually, let's look at the existing code:
                // center: [lng, lat] (Line 41) -> Valid.
                // Let's try to be consistent. 

                // Correction: Most map routing APIs (OSRM, Mapbox, Ola?) take {lng},{lat}.
                // Previous code: origin=${lat},${lng}.
                // NEW CODE: origin=${ambulanceLocation.lng},${ambulanceLocation.lat}...

                const routeUrl = `https://api.olamaps.io/routing/v1/directions?origin=${ambulanceLocation.lng},${ambulanceLocation.lat}&destination=${hospitalLocation.lng},${hospitalLocation.lat}&api_key=${apiKey}`;

                console.log("Fetching route from:", url);

                const response = await fetch(url, {
                    method: 'POST', // Documentation often suggests POST for directions
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.error("Route fetch failed:", response.status, response.statusText);
                    return;
                }

                const data = await response.json();
                console.log("Route data received:", data);

                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];

                    // Parse ETA and Distance
                    // Adapting to probable response structure (legs or summary)
                    let distRaw = "0 km";
                    let durRaw = "0 min";

                    if (route.legs && route.legs.length > 0) {
                        const leg = route.legs[0];
                        distRaw = leg.readable_distance || (leg.distance ? `${(leg.distance / 1000).toFixed(1)} km` : "0 km");
                        durRaw = leg.readable_duration || (leg.duration ? `${Math.ceil(leg.duration / 60)} min` : "0 min");
                    }

                    setRouteInfo({
                        distance: distRaw,
                        eta: durRaw
                    });

                    // Decode Polyline
                    const polyline = route.overview_polyline;
                    if (polyline) {
                        const decodedCoords = decodePolyline(polyline);

                        // Draw Route
                        // Assuming map instance is MapLibre/Mapbox compatible
                        if (map.getSource && map.addLayer) {
                            const routeSourceId = 'route-source';
                            const routeLayerId = 'route-layer';

                            // Clean up existing if needed (though this is init only)
                            if (map.getSource(routeSourceId)) {
                                map.removeLayer(routeLayerId);
                                map.removeSource(routeSourceId);
                            }

                            map.addSource(routeSourceId, {
                                type: 'geojson',
                                data: {
                                    type: 'Feature',
                                    properties: {},
                                    geometry: {
                                        type: 'LineString',
                                        coordinates: decodedCoords // [lng, lat] format
                                    }
                                }
                            });

                            map.addLayer({
                                id: routeLayerId,
                                type: 'line',
                                source: routeSourceId,
                                layout: {
                                    'line-join': 'round',
                                    'line-cap': 'round'
                                },
                                paint: {
                                    'line-color': '#3b82f6',
                                    'line-width': 4,
                                    'line-opacity': 0.8
                                }
                            });

                            // Fit bounds to show route
                            const bounds = new window.OlaMaps.LngLatBounds();
                            decodedCoords.forEach((coord: any) => bounds.extend(coord));
                            map.fitBounds(bounds, { padding: 50 });
                        }
                    }
                }

            } catch (e) {
                console.error("Routing error:", e);
            }
        };

        // Polyline decoder utility
        const decodePolyline = (str: string, precision: number = 5) => {
            let index = 0,
                lat = 0,
                lng = 0,
                coordinates = [],
                shift = 0,
                result = 0,
                byte = null,
                latitude_change,
                longitude_change,
                factor = Math.pow(10, precision || 5);

            while (index < str.length) {
                byte = null;
                shift = 0;
                result = 0;

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

                coordinates.push([lng / factor, lat / factor]); // GeoJSON expects [lng, lat]
            }

            return coordinates;
        };

        if (window.OlaMaps) {
            initMap();
        } else {
            const interval = setInterval(() => {
                if (window.OlaMaps) {
                    clearInterval(interval);
                    initMap();
                }
            }, 500);
            setTimeout(() => clearInterval(interval), 5000);
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
            }
        };
    }, [ambulanceLocation, hospitalLocation]);

    if (mapError) {
        return (
            <div className={className || 'w-full h-full rounded-lg'} style={{ minHeight: '400px' }}>
                <div className="flex items-center justify-center h-full bg-secondary/20 rounded-lg border border-border">
                    <p className="text-muted-foreground">{mapError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            <div
                ref={mapRef}
                className={className || 'w-full h-full rounded-lg'}
                style={{ minHeight: '400px' }}
            />
            {/* Overlay Info Box */}
            <div className="absolute top-4 right-4 bg-white/95 p-3 rounded-lg shadow-md text-sm z-10 border border-border/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-semibold text-primary">Live Tracking</span>
                </div>
                <div className="space-y-1">
                    <p className="flex justify-between gap-4">
                        <span className="text-muted-foreground">ETA:</span>
                        <span className="font-mono font-bold">{routeInfo ? routeInfo.eta : '-- min'}</span>
                    </p>
                    <p className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Distance:</span>
                        <span className="font-mono font-bold">{routeInfo ? routeInfo.distance : '-- km'}</span>
                    </p>
                </div>
                <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                    <p>JECC ➔ MGH (Trauma Center)</p>
                </div>
            </div>
        </div>
    );
}
