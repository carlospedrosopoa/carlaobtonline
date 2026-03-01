'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L, { type FeatureGroup as LeafletFeatureGroup } from 'leaflet';
import { FeatureGroup, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import type { RegiaoGeojson } from '@/lib/regiaoGeo';
import { centroidFromGeojson } from '@/lib/regiaoGeo';

type PointMin = { id: string; nome: string; latitude?: number | null; longitude?: number | null };

const shapeStyle: L.PathOptions = {
  color: '#7c3aed',
  weight: 3,
  opacity: 0.9,
  fillColor: '#7c3aed',
  fillOpacity: 0.18,
};

function toGeometryFromFeatureCollection(fc: any): RegiaoGeojson | null {
  const features = Array.isArray(fc?.features) ? fc.features : [];
  const geoms = features.map((f: any) => f?.geometry).filter(Boolean);
  if (geoms.length === 0) return null;
  if (geoms.length === 1) return geoms[0] as RegiaoGeojson;

  const polys = geoms
    .flatMap((g: any) => {
      if (g.type === 'Polygon') return [g.coordinates];
      if (g.type === 'MultiPolygon') return g.coordinates;
      return [];
    })
    .filter(Boolean);

  if (polys.length === 0) return null;
  return { type: 'MultiPolygon', coordinates: polys } as RegiaoGeojson;
}

function fixDefaultMarkerIcon() {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
  });
}

function FitBounds({ limiteGeojson }: { limiteGeojson: RegiaoGeojson | null }) {
  const map = useMap();

  useEffect(() => {
    if (!limiteGeojson) return;
    try {
      const layer = L.geoJSON(limiteGeojson as any, { style: shapeStyle });
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.1));
    } catch {}
  }, [limiteGeojson, map]);

  return null;
}

function GeoSearch({
  onResult,
}: {
  onResult: (r: { lat: number; lng: number; label: string } | null) => void;
}) {
  const map = useMap();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const buscar = async () => {
    const query = q.trim();
    if (!query) return;
    try {
      setLoading(true);
      setErro('');
      const res = await fetch(`/api/geocode?endereco=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.mensagem || 'Não foi possível localizar');
      }
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Localização inválida');
      }
      const label = String(data.enderecoCompleto || query);
      map.setView([lat, lng], Math.max(map.getZoom(), 13), { animate: true });
      onResult({ lat, lng, label });
    } catch (e: any) {
      setErro(e?.message || 'Erro ao buscar endereço');
      onResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-3 left-3 z-[1000] bg-white/95 border border-gray-200 rounded-md shadow-sm px-3 py-2 w-[320px]">
      <div className="text-xs font-medium text-gray-700 mb-1">Buscar referência</div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') buscar();
          }}
          placeholder='Ex: "São Paulo"'
          className="flex-1 px-2 py-1.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-60"
        >
          {loading ? '...' : 'Ir'}
        </button>
      </div>
      {erro && <div className="mt-1 text-xs text-red-600">{erro}</div>}
    </div>
  );
}

export default function RegiaoMapEditor({
  limiteGeojson,
  onChange,
  points,
}: {
  limiteGeojson: RegiaoGeojson | null;
  onChange: (geo: RegiaoGeojson | null) => void;
  points: PointMin[];
}) {
  const featureGroupRef = useRef<LeafletFeatureGroup>(null);
  const [busca, setBusca] = useState<{ lat: number; lng: number; label: string } | null>(null);

  const center = useMemo(() => {
    if (limiteGeojson) {
      try {
        const c = centroidFromGeojson(limiteGeojson);
        if (Number.isFinite(c.lat) && Number.isFinite(c.lng) && (c.lat !== 0 || c.lng !== 0)) {
          return [c.lat, c.lng] as [number, number];
        }
      } catch {}
    }
    const p = points.find((x) => x.latitude != null && x.longitude != null);
    if (p) return [Number(p.latitude), Number(p.longitude)] as [number, number];
    return [-30.0346, -51.2177] as [number, number];
  }, [limiteGeojson, points]);

  useEffect(() => {
    fixDefaultMarkerIcon();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const fg = featureGroupRef.current;
      if (!fg) return;
      fg.clearLayers();
      if (limiteGeojson) {
        const layer = L.geoJSON(limiteGeojson as any, { style: shapeStyle });
        layer.eachLayer((l) => fg.addLayer(l));
      }
    }, 0);
    return () => clearTimeout(t);
  }, [limiteGeojson]);

  const handleCreated = (e: any) => {
    const layer = e.layer;
    const feature = layer?.toGeoJSON?.();
    const geo = feature?.geometry as RegiaoGeojson | undefined;
    if (geo) onChange(geo);
  };

  const handleEdited = () => {
    const fg = featureGroupRef.current;
    if (!fg) return;
    const fc = fg.toGeoJSON();
    const geo = toGeometryFromFeatureCollection(fc);
    onChange(geo);
  };

  const handleDeleted = () => {
    onChange(null);
  };

  return (
    <div className="relative w-full h-[420px] rounded-md overflow-hidden border border-gray-200">
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoSearch onResult={setBusca} />
        <FitBounds limiteGeojson={limiteGeojson} />
        <FeatureGroup ref={featureGroupRef as any}>
          <EditControl
            position="topright"
            onCreated={handleCreated}
            onEdited={handleEdited}
            onDeleted={handleDeleted}
            draw={{
              polygon: { shapeOptions: shapeStyle },
              rectangle: { shapeOptions: shapeStyle },
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
            }}
            edit={{ remove: true }}
          />
        </FeatureGroup>
        {busca && (
          <Marker position={[busca.lat, busca.lng]}>
            <Popup>{busca.label}</Popup>
          </Marker>
        )}
        {points
          .filter((p) => p.latitude != null && p.longitude != null)
          .map((p) => (
            <Marker key={p.id} position={[Number(p.latitude), Number(p.longitude)]}>
              <Popup>{p.nome}</Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
