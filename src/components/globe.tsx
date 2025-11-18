'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export type GlobeTheme =
  | 'satellite-streets-v12'
  | 'satellite-v9'
  | 'streets-v12'
  | 'outdoors-v12'
  | 'light-v11'
  | 'dark-v11'
  | 'navigation-day-v1'
  | 'navigation-night-v1';

interface GlobeProps {
  onLocationClick: (location: { name: string; lat: number; lng: number }) => void;
  theme?: GlobeTheme;
}

export interface GlobeRef {
  selectRandomLocation: () => void;
}

// Suppress Mapbox abort errors globally - these are harmless and occur during normal operations
if (typeof window !== 'undefined') {
  // Override console.error to filter out AbortError
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const firstArg = args[0];

    // Check if it's an Error object with AbortError
    if (firstArg instanceof Error &&
        (firstArg.name === 'AbortError' || firstArg.message.includes('aborted'))) {
      return;
    }

    // Check if it's a string containing abort-related messages
    const message = firstArg?.toString() || '';
    if (message.includes('AbortError') || message.includes('signal is aborted')) {
      return;
    }

    originalError.apply(console, args);
  };

  // Also add global error event listener to catch unhandled errors
  const handleError = (event: ErrorEvent) => {
    if (event.error?.name === 'AbortError' || event.message?.includes('aborted')) {
      event.preventDefault();
      return;
    }
  };

  window.addEventListener('error', handleError);

  // Add unhandledrejection handler for promises
  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (reason?.name === 'AbortError' || reason?.message?.includes('aborted')) {
      event.preventDefault();
      return;
    }
  };

  window.addEventListener('unhandledrejection', handleRejection);
}

export const Globe = forwardRef<GlobeRef, GlobeProps>(function Globe({ onLocationClick, theme = 'satellite-streets-v12' }, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!mapboxToken) {
      setError('Mapbox access token is not configured');
      setIsLoading(false);
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        // Use selected theme style
        style: `mapbox://styles/mapbox/${theme}`,
        center: [0, 30], // Center on world view
        zoom: 1.5,
        projection: 'globe' as any, // Enable globe projection
        pitch: 0,
        bearing: 0,
        attributionControl: false, // Remove text attribution
        logoPosition: 'bottom-right' as any, // Move logo to bottom-right (less prominent)
      });

      mapRef.current = map;


      map.on('load', () => {
        // Set fog for atmosphere effect
        map.setFog({});
        setIsLoading(false);

        // Auto-rotation logic with proper interaction detection
        let userInteracting = false;
        let spinEnabled = true;
        const secondsPerRevolution = 120; // Slower rotation
        const maxSpinZoom = 5; // Stop spinning when zoomed in
        const slowSpinZoom = 3;

        function spinGlobe() {
          const zoom = map.getZoom();
          if (spinEnabled && !userInteracting && zoom < maxSpinZoom) {
            let distancePerSecond = 360 / secondsPerRevolution;
            if (zoom > slowSpinZoom) {
              // Slow down rotation when zoomed in
              const zoomDif = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
              distancePerSecond *= zoomDif;
            }
            const center = map.getCenter();
            center.lng -= distancePerSecond / 60; // 60 fps
            map.easeTo({ center, duration: 1000 / 60, easing: (n) => n });
          }
        }

        // Pause rotation on any user interaction
        map.on('mousedown', () => {
          userInteracting = true;
          spinEnabled = false;
        });

        map.on('mouseup', () => {
          userInteracting = false;
          // Resume spinning after 3 seconds of inactivity
          setTimeout(() => {
            if (!userInteracting) {
              spinEnabled = true;
            }
          }, 3000);
        });

        map.on('dragend', () => {
          userInteracting = false;
          setTimeout(() => {
            if (!userInteracting) {
              spinEnabled = true;
            }
          }, 3000);
        });

        map.on('pitchend', () => {
          userInteracting = false;
          setTimeout(() => {
            if (!userInteracting) {
              spinEnabled = true;
            }
          }, 3000);
        });

        map.on('rotateend', () => {
          userInteracting = false;
          setTimeout(() => {
            if (!userInteracting) {
              spinEnabled = true;
            }
          }, 3000);
        });

        // Pause on zoom
        map.on('zoomstart', () => {
          userInteracting = true;
          spinEnabled = false;
        });

        map.on('zoomend', () => {
          userInteracting = false;
          setTimeout(() => {
            if (!userInteracting) {
              spinEnabled = true;
            }
          }, 3000);
        });

        // Touch events
        map.on('touchstart', () => {
          userInteracting = true;
          spinEnabled = false;
        });

        map.on('touchend', () => {
          userInteracting = false;
          setTimeout(() => {
            if (!userInteracting) {
              spinEnabled = true;
            }
          }, 3000);
        });

        // Start the animation loop
        spinGlobe();
        setInterval(spinGlobe, 1000 / 60); // 60 fps
      });

      // Handle clicks on the map
      map.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        const zoom = map.getZoom();

        try {
          // Reverse geocode to get the location name with types parameter
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country,region,place,locality,district&access_token=${mapboxToken}`
          );
          const data = await response.json();

          if (data.features && data.features.length > 0) {
            // Select appropriate feature based on zoom level
            let selectedFeature = data.features[0];

            // Zoom level guidelines:
            // < 5: World/Continental view - ALWAYS prefer country
            // 5-7: Country view - prefer country or large region
            // 7-10: Regional view - prefer region or place
            // > 10: City view - prefer place or locality

            if (zoom < 5) {
              // Zoomed out - ALWAYS prefer country
              selectedFeature = data.features.find((f: any) => f.place_type?.includes('country')) || data.features[0];
            } else if (zoom < 7) {
              // Medium zoom - prefer country or large region
              selectedFeature = data.features.find((f: any) =>
                f.place_type?.includes('country') || f.place_type?.includes('region')
              ) || data.features[0];
            } else if (zoom < 10) {
              // Zoomed in - prefer region or place
              selectedFeature = data.features.find((f: any) =>
                f.place_type?.includes('region') || f.place_type?.includes('place')
              ) || data.features[0];
            }
            // Else: use most specific (default first feature) for very zoomed in views

            const locationName = selectedFeature.place_name || selectedFeature.text || `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;

            // Add a marker
            new mapboxgl.Marker({ color: '#FF6B6B' })
              .setLngLat([lng, lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 })
                  .setHTML(`<h3 class="font-semibold">${locationName}</h3><p class="text-sm">Click to research history</p>`)
              )
              .addTo(map);

            // Trigger the location click callback
            onLocationClick({
              name: locationName,
              lat,
              lng,
            });
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error);
          // Fallback: use coordinates
          onLocationClick({
            name: `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
            lat,
            lng,
          });
        }
      });

      // Change cursor on hover
      map.on('mouseenter', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', () => {
        map.getCanvas().style.cursor = '';
      });

    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map');
      setIsLoading(false);
    }

    return () => {
      if (mapRef.current) {
        try {
          // Remove the map - this will clean up all event listeners automatically
          mapRef.current.remove();
        } catch (error) {
          // Completely suppress all errors during cleanup - they're harmless
          // AbortErrors occur when Mapbox cancels ongoing tile requests during unmount
        }
        mapRef.current = null;
      }
    };
  }, [onLocationClick, theme]);

  // Update map style when theme changes
  useEffect(() => {
    if (mapRef.current && !isLoading) {
      mapRef.current.setStyle(`mapbox://styles/mapbox/${theme}`);
    }
  }, [theme, isLoading]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    selectRandomLocation: async () => {
      if (!mapRef.current) return;

      const map = mapRef.current;
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) return;

      // Generate random coordinates
      const lat = (Math.random() * 180) - 90; // -90 to 90
      const lng = (Math.random() * 360) - 180; // -180 to 180

      // Spin the globe to the location with animation
      map.easeTo({
        center: [lng, lat],
        zoom: 3,
        duration: 2000,
        easing: (t) => t * (2 - t), // easeOutQuad
      });

      // After animation, perform reverse geocoding and trigger selection
      setTimeout(async () => {
        try {
          // Use types parameter to get country-level results
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country,region,place&access_token=${mapboxToken}`
          );
          const data = await response.json();

          if (data.features && data.features.length > 0) {
            // Prefer country or region for random selection (zoom is 3)
            const selectedFeature = data.features.find((f: any) =>
              f.place_type?.includes('country') || f.place_type?.includes('region')
            ) || data.features[0];

            const locationName = selectedFeature.place_name || selectedFeature.text || `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;

            // Add a marker
            new mapboxgl.Marker({ color: '#FF6B6B' })
              .setLngLat([lng, lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 })
                  .setHTML(`<h3 class="font-semibold">${locationName}</h3><p class="text-sm">Researching history...</p>`)
              )
              .addTo(map);

            // Trigger the location click callback
            onLocationClick({
              name: locationName,
              lat,
              lng,
            });
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error);
          // Fallback: use coordinates
          onLocationClick({
            name: `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
            lat,
            lng,
          });
        }
      }, 2100); // Slightly after animation completes
    },
  }));

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-destructive mb-2">Map Error</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Please check your Mapbox configuration
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading globe...</p>
          </div>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
        <p className="text-sm font-medium">Click anywhere on the globe to research its history</p>
        <p className="text-xs text-muted-foreground mt-1">Rotation pauses when you interact</p>
      </div>
    </div>
  );
});
