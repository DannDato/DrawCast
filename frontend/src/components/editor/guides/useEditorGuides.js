import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteChannelGuide, getChannelGuide, getChannelGuides, saveChannelGuide } from '../../../api/guides';
import { captureGuide } from './captureGuide';

function storedGuide(publicKey) {
  try { return localStorage.getItem(`TRAZIO.editor.guide.${publicKey}`) || 'none'; } catch { return 'none'; }
}

export default function useEditorGuides({ channelUuid, publicKey, socket, objectsRef, setMediaStatus }) {
  const [collection, setCollection] = useState({ channelUuid: null, guides: [] });
  const [selection, setSelection] = useState({});
  const [image, setImage] = useState(null);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const requestRef = useRef({ version: 0 });
  const guides = useMemo(() => collection.channelUuid === channelUuid ? collection.guides : [], [collection, channelUuid]);
  const selected = selection[publicKey] ?? storedGuide(publicKey);
  const guide = guides.some((item) => String(item.slot) === selected) ? selected : 'none';
  const activeGuide = guides.find((item) => String(item.slot) === guide);
  const guideImageUrl = image?.channelUuid === channelUuid && image?.slot === guide && image?.updatedAt === activeGuide?.updatedAt ? image.imageData : null;

  const setGuide = useCallback((value) => {
    const slot = /^[1-3]$/.test(String(value)) ? String(value) : 'none';
    setSelection((current) => ({ ...current, [publicKey]: slot }));
    try { localStorage.setItem(`TRAZIO.editor.guide.${publicKey}`, slot); } catch { /* noop */ }
  }, [publicKey]);

  const refreshGuides = useCallback(() => {
    const request = ++requestRef.current.version;
    return (channelUuid ? getChannelGuides(channelUuid) : Promise.resolve([])).then((rows) => {
      if (request === requestRef.current.version) setCollection({ channelUuid, guides: rows });
    }).catch((error) => {
      if (request !== requestRef.current.version) return;
      setCollection({ channelUuid, guides: [] });
      setMediaStatus(error.response?.data?.message || 'No se pudieron cargar las guías del lienzo.');
    });
  }, [channelUuid, setMediaStatus]);

  useEffect(() => {
    const requests = requestRef.current;
    void refreshGuides();
    socket.on('guides-changed', refreshGuides);
    socket.on('connect', refreshGuides);
    return () => {
      requests.version++;
      socket.off('guides-changed', refreshGuides);
      socket.off('connect', refreshGuides);
    };
  }, [socket, refreshGuides]);

  useEffect(() => {
    if (!channelUuid || guide === 'none') return undefined;
    let active = true;
    getChannelGuide(channelUuid, guide).then((value) => {
      if (active) setImage({ channelUuid, slot: guide, imageData: value.imageData, updatedAt: value.updatedAt });
    }).catch((error) => {
      if (!active) return;
      setImage(null);
      setMediaStatus(error.response?.data?.message || 'No se pudo abrir la guía.');
    });
    return () => { active = false; };
  }, [channelUuid, guide, guides, setMediaStatus]);

  const saveGuide = async (slot) => {
    if (!channelUuid) throw new Error('El lienzo todavía no está listo.');
    const imageData = await captureGuide(objectsRef.current);
    await saveChannelGuide(channelUuid, slot, { imageData });
    await refreshGuides();
    setGuide(slot);
    setMediaStatus(`Guía ${slot} guardada para este lienzo.`);
  };

  const deleteGuide = async (slot) => {
    if (!channelUuid) throw new Error('El lienzo todavía no está listo.');
    await deleteChannelGuide(channelUuid, slot);
    if (selected === String(slot)) setGuide('none');
    await refreshGuides();
  };

  return { guide, setGuide, guides, guideImageUrl, guidesOpen, setGuidesOpen, refreshGuides, saveGuide, deleteGuide };
}
