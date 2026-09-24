import { useEffect } from 'react';
import { parseClipboardText } from '../clipboard/clipboardUtils';
import { TOOL_LABELS } from './shortcuts';

export default function useEditorHotkeys({
  guides,
  workspaceMode,
  editingLocked,
  hotkeysOpen,
  setHotkeysOpen,
  tool,
  setTool,
  setGuide,
  setMediaStatus,
  setImagePickerRequest,
  requestClear,
  redo,
  undo,
  selectAllLayers,
  moveSelectedLayer,
  ungroupSelection,
  groupSelection,
  duplicateSelected,
  nudgeSelection,
  removeLayers,
  setSelection,
  finishNudge,
  copySelection,
  cutSelection,
  setClipboardPayload,
  pasteClipboard,
  isToolEnabled = () => false,
  guidesEnabled = false,
  onLockedFeature
}) {
  useEffect(() => {
    const isEditableTarget = (target) => target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
    const guideByKey = {
      '0': 'none',
      '1': '1',
      '2': '2',
      '3': '3'
    };
    const toolByKey = {
      v: 'select',
      h: 'hand',
      p: 'draw',
      e: 'eraser',
      s: 'shape',
      g: 'shape',
      l: 'line',
      t: 'text',
      r: 'timer'
    };

    const toggleHotkeys = (event) => {
      event.preventDefault();
      setHotkeysOpen((value) => !value);
    };

    const onKeyDown = (event) => {
      if (document.querySelector('.dc-system-alert-backdrop, .dc-guides-modal')) return;
      if (isEditableTarget(event.target)) return;
      if (workspaceMode === 'launchpad') return;
      if (editingLocked) return;

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (event.key === 'F1' || (!modifier && !event.altKey && event.key === '?')) {
        toggleHotkeys(event);
        return;
      }

      if (hotkeysOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setHotkeysOpen(false);
        }
        return;
      }

      if (modifier && event.shiftKey && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        requestClear();
        return;
      }
      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && key === 'a') {
        event.preventDefault();
        selectAllLayers();
        return;
      }
      if (modifier && event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelectedLayer('up');
        return;
      }
      if (modifier && event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelectedLayer('down');
        return;
      }
      if (modifier && key === 'g') {
        event.preventDefault();
        if (event.shiftKey) ungroupSelection();
        else groupSelection();
        return;
      }
      if (modifier && key === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }

      if (!modifier && !event.altKey && Object.prototype.hasOwnProperty.call(guideByKey, event.key)) {
        event.preventDefault();
        if (event.key !== '0' && !guidesEnabled) { onLockedFeature?.('editor.guides', 'Guías'); return; }
        if (event.key !== '0' && !guides.some((item) => String(item.slot) === event.key)) {
          setMediaStatus(`La guía ${event.key} todavía no está guardada.`);
          return;
        }
        setGuide(guideByKey[event.key]);
        setMediaStatus(guideByKey[event.key] === 'none' ? 'Guías desactivadas.' : `Guía ${event.key} activada.`);
        return;
      }

      if (!modifier && !event.altKey && !event.shiftKey && key === 'i') {
        event.preventDefault();
        if (!isToolEnabled('image')) { onLockedFeature?.('editor.image', 'Imagen / GIF'); return; }
        setImagePickerRequest((current) => current + 1);
        setMediaStatus('Selecciona una imagen o GIF para agregar.');
        return;
      }

      if (!modifier && !event.altKey && !event.shiftKey && toolByKey[key]) {
        event.preventDefault();
        const nextTool = toolByKey[key];
        if (!isToolEnabled(nextTool)) { const feature = { select: 'editor.select', hand: 'editor.pan', draw: 'editor.brush', eraser: 'editor.eraser', shape: 'editor.shape', line: 'editor.line', text: 'editor.text', timer: 'editor.timer' }[nextTool]; onLockedFeature?.(feature, TOOL_LABELS[nextTool] || nextTool); return; }
        setTool(nextTool);
        setMediaStatus(`Herramienta: ${TOOL_LABELS[toolByKey[key]] || toolByKey[key]}.`);
        return;
      }

      if (!modifier && !event.altKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const step = event.shiftKey ? 10 : 1;
        const delta = {
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0]
        }[event.key];
        if (nudgeSelection(delta[0], delta[1])) event.preventDefault();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeLayers();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (tool !== 'select') {
          setTool('select');
          setMediaStatus('Herramienta: Selección');
        } else {
          setSelection([]);
        }
      }
    };

    const onKeyUp = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) finishNudge();
    };

    const onCopy = (event) => {
      if (isEditableTarget(event.target) || hotkeysOpen || document.querySelector('.dc-guides-modal')) return;
      copySelection(event);
    };

    const onCut = (event) => {
      if (isEditableTarget(event.target) || hotkeysOpen || document.querySelector('.dc-guides-modal')) return;
      cutSelection(event);
    };

    const onPaste = (event) => {
      if (isEditableTarget(event.target) || hotkeysOpen || document.querySelector('.dc-guides-modal')) return;
      const parsed = parseClipboardText(event.clipboardData?.getData('text/plain') || '');
      if (!parsed) return;
      event.preventDefault();
      setClipboardPayload(parsed);
      pasteClipboard(parsed, 1);
    };

    const onWindowBlur = () => finishNudge();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCut);
    window.addEventListener('paste', onPaste);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCut);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('blur', onWindowBlur);
    };
  });

}
