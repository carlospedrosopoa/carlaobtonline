'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { regiaoService } from '@/services/regiaoService';
import type { Regiao } from '@/types/regiao';
import type { RegiaoGeojson } from '@/lib/regiaoGeo';
import { validarRegiaoGeojson } from '@/lib/regiaoGeo';

type PointMin = { id: string; nome: string; latitude?: number | null; longitude?: number | null; ativo?: boolean };

function extrairGeometry(obj: any) {
  if (!obj) return obj;
  if (obj.type === 'Feature' && obj.geometry) return obj.geometry;
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features) && obj.features[0]?.geometry) return obj.features[0].geometry;
  return obj;
}

const RegiaoMapEditor = dynamic(() => import('@/components/RegiaoMapEditor'), { ssr: false });

export default function RegioesAdminPage() {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [points, setPoints] = useState<PointMin[]>([]);

  const [regiaoId, setRegiaoId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [limiteText, setLimiteText] = useState('{\n  \"type\": \"Polygon\",\n  \"coordinates\": []\n}');
  const [pointIds, setPointIds] = useState<string[]>([]);
  const [filtroPoint, setFiltroPoint] = useState('');

  const limiteGeojson = useMemo(() => {
    try {
      const obj = JSON.parse(limiteText);
      const geometry = extrairGeometry(obj);
      const valid = validarRegiaoGeojson(geometry);
      return valid.ok ? (valid.geojson as RegiaoGeojson) : null;
    } catch {
      return null;
    }
  }, [limiteText]);

  const pointsFiltrados = useMemo(() => {
    const q = filtroPoint.trim().toLowerCase();
    if (!q) return points;
    return points.filter((p) => p.nome.toLowerCase().includes(q));
  }, [points, filtroPoint]);

  const carregar = async () => {
    try {
      setLoading(true);
      setErro('');
      const [regioesList, pointsRes] = await Promise.all([
        regiaoService.listar(),
        api.get('/point', { params: { apenasAtivos: true } }),
      ]);
      setRegioes(regioesList);
      const pts = (pointsRes.data || []).map((p: any) => ({
        id: p.id,
        nome: p.nome,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        ativo: p.ativo ?? null,
      }));
      setPoints(pts);
    } catch (e: any) {
      setErro(e?.data?.mensagem || e?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const selecionar = async (id: string) => {
    try {
      setErro('');
      setSucesso('');
      setLoading(true);
      const data = await regiaoService.obter(id);
      setRegiaoId(data.id);
      setNome(data.nome || '');
      setAtivo(Boolean(data.ativo));
      setPointIds(data.pointIds || []);
      setLimiteText(JSON.stringify(data.limiteGeojson, null, 2));
    } catch (e: any) {
      setErro(e?.data?.mensagem || e?.message || 'Erro ao carregar região');
    } finally {
      setLoading(false);
    }
  };

  const novo = () => {
    setRegiaoId(null);
    setNome('');
    setAtivo(true);
    setPointIds([]);
    setLimiteText('{\n  \"type\": \"Polygon\",\n  \"coordinates\": []\n}');
    setErro('');
    setSucesso('');
  };

  const togglePoint = (id: string) => {
    setPointIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const salvar = async () => {
    try {
      setSalvando(true);
      setErro('');
      setSucesso('');

      let obj: any;
      try {
        obj = JSON.parse(limiteText);
      } catch {
        throw new Error('GeoJSON inválido (JSON)');
      }
      const geometry = extrairGeometry(obj);

      if (!nome.trim()) {
        throw new Error('Informe o nome da região');
      }

      const payload = {
        nome: nome.trim(),
        ativo,
        limiteGeojson: geometry,
        pointIds,
      };

      const saved = regiaoId ? await regiaoService.atualizar(regiaoId, payload) : await regiaoService.criar(payload);
      setRegiaoId(saved.id);
      setSucesso('Região salva com sucesso');
      await carregar();
    } catch (e: any) {
      setErro(e?.data?.mensagem || e?.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!regiaoId) return;
    try {
      setSalvando(true);
      setErro('');
      setSucesso('');
      await regiaoService.remover(regiaoId);
      setSucesso('Região removida');
      novo();
      await carregar();
    } catch (e: any) {
      setErro(e?.data?.mensagem || e?.message || 'Erro ao remover');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regiões</h1>
          <p className="text-sm text-gray-600">Cadastre regiões e vincule arenas</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={novo}
            className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Nova
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          {regiaoId && (
            <button
              type="button"
              onClick={remover}
              disabled={salvando}
              className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {erro && <div className="p-3 rounded-md bg-red-50 text-red-700 border border-red-200">{erro}</div>}
      {sucesso && <div className="p-3 rounded-md bg-green-50 text-green-700 border border-green-200">{sucesso}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 font-semibold text-gray-800">Lista</div>
            <div className="max-h-[520px] overflow-auto">
              {regioes.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Nenhuma região cadastrada</div>
              ) : (
                regioes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selecionar(r.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                      regiaoId === r.id ? 'bg-purple-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{r.nome}</div>
                      <div className={`text-xs px-2 py-0.5 rounded-full ${r.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.ativo ? 'Ativa' : 'Inativa'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {typeof r.arenasCount === 'number' ? `${r.arenasCount} arenas` : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                  Ativa
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Limite (GeoJSON)</label>
              <textarea
                value={limiteText}
                onChange={(e) => setLimiteText(e.target.value)}
                rows={10}
                className="w-full font-mono text-xs px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium text-gray-700">Mapa</div>
                <div className="text-xs text-gray-600">Desenhe/edite o limite e ele será convertido em GeoJSON</div>
              </div>
              <RegiaoMapEditor
                limiteGeojson={limiteGeojson}
                onChange={(geo) =>
                  setLimiteText(
                    geo ? JSON.stringify(geo, null, 2) : '{\n  \"type\": \"Polygon\",\n  \"coordinates\": []\n}'
                  )
                }
                points={points.filter((p) => pointIds.includes(p.id))}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="font-semibold text-gray-800">Arenas da região</div>
              <input
                value={filtroPoint}
                onChange={(e) => setFiltroPoint(e.target.value)}
                placeholder="Buscar arena..."
                className="px-3 py-2 rounded-md border border-gray-300 text-sm"
              />
            </div>
            <div className="max-h-[280px] overflow-auto border border-gray-100 rounded-md">
              {pointsFiltrados.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 text-sm">
                  <input type="checkbox" checked={pointIds.includes(p.id)} onChange={() => togglePoint(p.id)} />
                  <span className="flex-1">{p.nome}</span>
                  <span className="text-xs text-gray-500">{p.latitude != null && p.longitude != null ? '📍' : ''}</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-gray-600">{pointIds.length} arenas selecionadas</div>
          </div>
        </div>
      </div>
    </div>
  );
}
