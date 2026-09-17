import { useRef, useState } from 'react';
import { ImagePlus, Search, Upload, X } from 'lucide-react';
import { searchChannelImages } from '../../api/media';
import { DEFAULT_IMAGE_CONFIG } from './tools/images/imageTool';

export default function ImagePanel({ channelId, tool, selected, imageConfig, setImageConfig, onPatch, onUploadFile, onImportUrl }) {
  const inputRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('Arrastra un resultado al lienzo para agregarlo.');
  const [searching, setSearching] = useState(false);
  const isImage = selected?.tipo === 'image' || selected?.tipo === 'imagen';

  if (tool !== 'image' && !isImage) return null;

  const current = isImage ? {
    borderRadius: Number(selected.borderRadius ?? selected.radius) || 0,
    opacity: Number.isFinite(Number(selected.opacity)) ? Number(selected.opacity) : 1
  } : imageConfig;

  const updateConfig = (patch) => {
    const next = { ...DEFAULT_IMAGE_CONFIG, ...imageConfig, ...patch };
    setImageConfig(next);
    if (isImage) onPatch(patch);
  };

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setStatus('Escribe un término de búsqueda.');
      return;
    }

    if (!channelId) {
      setStatus('Canal no disponible todavía.');
      return;
    }

    setSearching(true);
    setResults([]);
    setStatus('Buscando imágenes web...');

    try {
      const data = await searchChannelImages(channelId, trimmed);
      setResults(data.results || []);
      setStatus(`${data.results?.length || 0} resultado${data.results?.length === 1 ? '' : 's'} en Wikimedia Commons. Arrastra una imagen al lienzo.`);
    } catch (error) {
      setStatus(error.response?.data?.message || error.response?.data?.error || 'No fue posible buscar imágenes.');
    } finally {
      setSearching(false);
    }
  };

  const onFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await onUploadFile(file);
  };

  return (
    <section className="dc-image-panel">
      <h3>IMÁGENES // GIF</h3>

      <label>ESQUINAS REDONDEADAS <b>{Math.round(current.borderRadius)}</b></label>
      <input type="range" min="0" max="300" value={current.borderRadius} onChange={(event) => updateConfig({ borderRadius: Number(event.target.value) })} />

      <label>OPACIDAD <b>{Math.round(current.opacity * 100)}%</b></label>
      <input type="range" min="0" max="100" value={Math.round(current.opacity * 100)} onChange={(event) => updateConfig({ opacity: Number(event.target.value) / 100 })} />

      <div className="dc-image-actions">
        <button type="button" onClick={() => inputRef.current?.click()}><Upload size={15} /> SUBIR</button>
        <button type="button" className={searchOpen ? 'active' : ''} onClick={() => setSearchOpen((currentOpen) => !currentOpen)}>{searchOpen ? <X size={15} /> : <Search size={15} />} {searchOpen ? 'OCULTAR' : 'BUSCAR'}</button>
      </div>

      <input ref={inputRef} className="dc-hidden-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.gif" onChange={onFileChange} />

      {searchOpen && (
        <div className="dc-image-search-panel">
          <label>BUSCAR EN LA WEB</label>
          <div className="dc-image-search-row">
            <input value={query} placeholder="Ej: anime png transparente" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); runSearch(); } }} />
            <button type="button" disabled={searching} onClick={runSearch}><Search size={15} /></button>
          </div>

          <button type="button" className="dc-image-search-submit" disabled={searching} onClick={runSearch}>{searching ? 'BUSCANDO...' : 'BUSCAR EN WIKIMEDIA'}</button>
          <p className="dc-image-search-status">{status}</p>

          <div className="dc-image-search-results">
            {results.map((item) => (
              <button
                type="button"
                key={`${item.imageUrl}-${item.title}`}
                className="dc-image-result-card"
                draggable
                title="Arrastra al lienzo o haz doble clic para agregar"
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData('text/plain', item.imageUrl);
                  event.dataTransfer.setData('text/uri-list', item.imageUrl);
                }}
                onDoubleClick={() => onImportUrl(item.imageUrl)}
              >
                <img src={item.thumbnailUrl || item.imageUrl} alt="" loading="lazy" />
                <span>{item.title || 'Imagen'}</span>
              </button>
            ))}
          </div>

          {!results.length && !searching && <div className="dc-image-search-empty"><ImagePlus size={18} /> TODAVÍA NO HAY RESULTADOS</div>}
        </div>
      )}
    </section>
  );
}
