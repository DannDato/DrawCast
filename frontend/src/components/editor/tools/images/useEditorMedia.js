import { importChannelImageUrl, uploadChannelImage } from '../../../../api/media';
import { makeImage } from '../../objectFactory';
import { fitImageSize, getImageKind, loadImageMetadata, validateImageFile } from './imageTool';

export default function useEditorMedia({ channelUuid, editingLocked, imageConfig, add, setTool, openPropertiesAt, setMediaStatus }) {
  const addMediaObject = async ({ url, name, mimeType, point }) => {
    const metadata = await loadImageMetadata(url);
    const size = fitImageSize(metadata.naturalWidth, metadata.naturalHeight);
    const x = point && Number.isFinite(point.x) ? point.x : 200;
    const y = point && Number.isFinite(point.y) ? point.y : 200;
    const object = makeImage(x, y, url, name, {
      ...imageConfig,
      ...size,
      ...metadata,
      mimeType,
      mediaKind: getImageKind(mimeType, name)
    });

    add(object);
    setTool('select');
    openPropertiesAt();
    return object;
  };

  const uploadFile = async (file, point = null) => {
    if (editingLocked) return;
    if (!channelUuid) {
      setMediaStatus('El canal todavía no está listo.');
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setMediaStatus(validationError);
      return;
    }

    setMediaStatus(`Subiendo ${file.name}...`);
    try {
      const data = await uploadChannelImage(channelUuid, file);
      await addMediaObject({ url: data.url, name: file.name, mimeType: data.mimeType || file.type, point });
      setMediaStatus(`${data.mediaKind === 'gif' ? 'GIF' : 'Imagen'} lista: ${file.name}`);
    } catch (error) {
      setMediaStatus(error.response?.data?.message || error.response?.data?.error || 'No se pudo subir la imagen.');
    }
  };

  const importRemote = async (url, point = null) => {
    if (editingLocked) return;
    if (!channelUuid) {
      setMediaStatus('El canal todavía no está listo.');
      return;
    }

    setMediaStatus('Importando imagen desde la web...');
    try {
      const data = await importChannelImageUrl(channelUuid, url);
      const name = data.fileName || 'Imagen web';
      await addMediaObject({ url: data.url, name, mimeType: data.mimeType || '', point });
      setMediaStatus(`${data.mediaKind === 'gif' ? 'GIF' : 'Imagen'} importada.`);
    } catch (error) {
      setMediaStatus(error.response?.data?.message || error.response?.data?.error || 'No se pudo importar la imagen.');
    }
  };

  return { uploadFile, importRemote };
}
