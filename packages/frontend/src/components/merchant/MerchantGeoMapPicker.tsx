import { useEffect, useRef } from 'react';

const SCRIPT_ID = 'gmaps-merchant-geo-picker';

function loadMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const g = (window as unknown as { google?: { maps?: unknown } }).google;
  if (g?.maps) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const gm = (window as unknown as { google?: { maps?: unknown } }).google?.maps;
        if (gm) {
          clearInterval(iv);
          resolve();
        } else if (Date.now() - t0 > 20000) {
          clearInterval(iv);
          reject(new Error('Google Maps không tải được.'));
        }
      }, 50);
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google Maps không tải được.'));
    document.head.appendChild(s);
  });
}

export interface MerchantGeoMapPickerProps {
  apiKey: string;
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  disabled?: boolean;
  onPositionChange: (lat: number, lng: number) => void;
}

/** Bản đồ chọn tâm geo-fence (khi có VITE_GOOGLE_MAPS_API_KEY). */
export function MerchantGeoMapPicker({
  apiKey,
  latitude,
  longitude,
  radiusM,
  disabled,
  onPositionChange,
}: MerchantGeoMapPickerProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const circleRef = useRef<unknown>(null);

  const defaultCenter = { lat: 10.7769, lng: 106.7009 };
  const center =
    latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { lat: latitude, lng: longitude }
      : defaultCenter;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadMaps(apiKey);
        if (cancelled || !divRef.current) return;
        const maps = (window as unknown as { google: { maps: any } }).google.maps;
        const map = new maps.Map(divRef.current, {
          center,
          zoom: latitude != null && longitude != null ? 17 : 12,
          disableDefaultUI: disabled,
          gestureHandling: disabled ? 'none' : 'greedy',
        });
        mapRef.current = map;
        const marker = new maps.Marker({
          position: center,
          map,
          draggable: !disabled,
        });
        markerRef.current = marker;
        const circle = new maps.Circle({
          strokeColor: '#006d37',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#006d37',
          fillOpacity: 0.12,
          map,
          center,
          radius: radiusM > 0 ? radiusM : 150,
        });
        circleRef.current = circle;

        map.addListener('click', (e: { latLng: { lat: () => number; lng: () => number } }) => {
          if (disabled) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          marker.setPosition(e.latLng);
          circle.setCenter(e.latLng);
          onPositionChange(lat, lng);
        });
        marker.addListener('dragend', (e: { latLng: { lat: () => number; lng: () => number } }) => {
          if (disabled) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          circle.setCenter(e.latLng);
          onPositionChange(lat, lng);
        });
      } catch {
        /* SettingsTab có fallback form số */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const maps = (window as unknown as { google?: { maps?: any } }).google?.maps;
    if (!maps || !mapRef.current) return;
    const map = mapRef.current as { setCenter: (p: { lat: number; lng: number }) => void };
    const marker = markerRef.current as { setPosition: (p: { lat: number; lng: number }) => void };
    const circle = circleRef.current as { setCenter: (p: { lat: number; lng: number }) => void; setRadius: (r: number) => void };
    if (!map || !marker || !circle) return;

    const pos =
      latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { lat: latitude, lng: longitude }
        : defaultCenter;
    map.setCenter(pos);
    marker.setPosition(pos);
    circle.setCenter(pos);
    circle.setRadius(radiusM > 0 ? radiusM : 150);
  }, [latitude, longitude, radiusM]);

  return <div ref={divRef} className="w-full h-[280px] rounded-xl border border-slate-200 overflow-hidden bg-surface-container-low" />;
}
