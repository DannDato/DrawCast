import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { importChannelImageUrl, uploadChannelImage } from '../api/media';
import { useChannelSocket } from '../hooks/useChannelSocket';
import CanvasStage from '../components/editor/CanvasStage';
import Inspector from '../components/editor/Inspector';
import LayersPanel from '../components/editor/LayersPanel';
import Toolbar from '../components/editor/Toolbar';
import { makeDraw, makeImage, makeShape, makeText, makeTimer } from '../components/editor/objectFactory';
import { DEFAULT_SHAPE_CONFIG } from '../components/editor/tools/shapes/shapeTool';
import { DEFAULT_IMAGE_CONFIG, fitImageSize, getImageKind, loadImageMetadata, validateImageFile } from '../components/editor/tools/images/imageTool';

export default function Editor() {
  const { publicKey } = useParams();
  const [channelId, setChannelId] = useState(null);
  const [objects, setObjects] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState('select');
  const [guide, setGuide] = useState('none');
  const [drawConfig, setDrawConfig] = useState({ color: '#ebebeb', size: 10 });
  const [shapeConfig, setShapeConfig] = useState(DEFAULT_SHAPE_CONFIG);
  const [imageConfig, setImageConfig] = useState(DEFAULT_IMAGE_CONFIG);
  const [history, setHistory] = useState([]);
  const [mediaStatus, setMediaStatus] = useState('');

  const handlers = useMemo(() => ({
    'sync-state': ({ objects: list }) => setObjects(Object.fromEntries(list.map((object) => [object.id, object]))),
    'obj-upsert': (object) => setObjects((current) => ({ ...current, [object.id]: object })),
    'obj-remove': ({ id }) => setObjects((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    }),
    'clear-all': () => setObjects({})
  }), []);

  const { socket, presence, connected, denied } = useChannelSocket(publicKey, 'editor', handlers);

  const snapshot = () => setHistory((current) => [...current.slice(-29), objects]);

  const upsert = (object) => {
    setObjects((current) => ({ ...current, [object.id]: object }));
    socket.emit('obj-upsert', object);
  };

  const patch = (id, patchData) => {
    const current = objects[id];
    if (!current) return;
    upsert({ ...current, ...patchData });
  };

  const add = (object) => {
    snapshot();
    upsert(object);
    setSelectedId(object.id);
  };

  const clear = () => {
    snapshot();
    setObjects({});
    setSelectedId(null);
    socket.emit('clear-all');
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setObjects(previous);
    socket.emit('clear-all');
    Object.values(previous).forEach((object) => socket.emit('obj-upsert', object));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    snapshot();
    socket.emit('obj-remove', { id: selectedId });
    setObjects((current) => {
      const next = { ...current };
      delete next[selectedId];
      return next;
    });
    setSelectedId(null);
  };

  useEffect(() => {
    api.get('/channels/mine').then(({ data }) => {
      const allChannels = [data.owned, ...(data.collaborations || [])].filter(Boolean);
      setChannelId(allChannels.find((channel) => channel.publicKey === publicKey)?.id || null);
    });
  }, [publicKey]);

  const addMediaObject = async ({ url, name, mimeType, point }) => {
    const metadata = await loadImageMetadata(url);
    const size = fitImageSize(metadata.naturalWidth, metadata.naturalHeight);
    const rawX = point && Number.isFinite(point.x) ? point.x : 200;
    const rawY = point && Number.isFinite(point.y) ? point.y : 200;
    const x = Math.max(0, Math.min(1920 - size.w, rawX));
    const y = Math.max(0, Math.min(1080 - size.h, rawY));

    add(makeImage(x, y, url, name, {
      ...imageConfig,
      ...size,
      ...metadata,
      mimeType,
      mediaKind: getImageKind(mimeType, name)
    }));
    setTool('select');
  };

  const uploadFile = async (file, point = null) => {
    if (!channelId) {
      setMediaStatus('CHANNEL NOT READY');
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setMediaStatus(validationError);
      return;
    }

    setMediaStatus(`UPLOADING // ${file.name}`);
    try {
      const data = await uploadChannelImage(channelId, file);
      await addMediaObject({ url: data.url, name: file.name, mimeType: data.mimeType || file.type, point });
      setMediaStatus(`${data.mediaKind === 'gif' ? 'GIF' : 'IMAGE'} READY // ${file.name}`);
    } catch (error) {
      setMediaStatus(error.response?.data?.message || error.response?.data?.error || 'UPLOAD FAILED');
    }
  };

  const importRemote = async (url, point = null) => {
    if (!channelId) {
      setMediaStatus('CHANNEL NOT READY');
      return;
    }

    setMediaStatus('IMPORTING REMOTE IMAGE...');
    try {
      const data = await importChannelImageUrl(channelId, url);
      const name = data.fileName || 'Imagen web';
      await addMediaObject({ url: data.url, name, mimeType: data.mimeType || '', point });
      setMediaStatus(`${data.mediaKind === 'gif' ? 'GIF' : 'IMAGE'} IMPORTED`);
    } catch (error) {
      setMediaStatus(error.response?.data?.message || error.response?.data?.error || 'REMOTE IMPORT FAILED');
    }
  };

  const chooseTool = (nextTool) => {
    if (nextTool === 'text') {
      add(makeText(700, 450));
      setTool('select');
      return;
    }

    if (nextTool === 'timer') {
      add(makeTimer(700, 450));
      setTool('select');
      return;
    }

    setTool(nextTool);
  };

  if (denied) return <div className="dc-denied">ACCESS DENIED // <Link to="/app">RETURN</Link></div>;

  return (
    <div className="dc-editor">
      <Toolbar tool={tool} setTool={chooseTool} guide={guide} setGuide={setGuide} onClear={clear} onUndo={undo} connected={connected} />

      <main className="dc-workspace">
        <div className="dc-watermark">DrawCast <span>// DannDato</span></div>

        <CanvasStage
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onPatchObject={patch}
          onTransformStart={snapshot}
          tool={tool}
          drawConfig={drawConfig}
          onDraw={(lines) => add(makeDraw(lines))}
          shapeConfig={shapeConfig}
          onShapeCreate={(draft) => {
            add(makeShape(draft));
            setTool('select');
          }}
          onMediaDrop={({ file, url, point }) => file ? uploadFile(file, point) : importRemote(url, point)}
          guide={guide}
        />

        <div className="dc-status">
          <b>{connected ? 'ONLINE' : 'OFFLINE'}</b>
          CLIENTS {presence.clients} // EDITORS {presence.editors} // OBS {presence.overlays}
          {mediaStatus && <span className="dc-media-status"> // {mediaStatus}</span>}
        </div>

        <LayersPanel objects={objects} selectedId={selectedId} onSelect={setSelectedId} onPatch={patch} />
      </main>

      <Inspector
        tool={tool}
        selected={objects[selectedId]}
        drawConfig={drawConfig}
        setDrawConfig={setDrawConfig}
        shapeConfig={shapeConfig}
        setShapeConfig={setShapeConfig}
        imageConfig={imageConfig}
        setImageConfig={setImageConfig}
        channelId={channelId}
        onUploadFile={uploadFile}
        onImportUrl={importRemote}
        onPatch={(patchData) => patch(selectedId, patchData)}
        onDelete={removeSelected}
      />
    </div>
  );
}
