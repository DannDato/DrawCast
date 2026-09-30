import { createElement } from 'react';
import { AudioLines, Layers3, LayoutTemplate, Package, PanelsTopLeft, ScanLine, Shapes, Sparkles, Timer, Type, Upload, Volume2 } from 'lucide-react';

const icons = {
  sparkles: Sparkles,
  'panels-top-left': PanelsTopLeft,
  type: Type,
  shapes: Shapes,
  timer: Timer,
  'scan-line': ScanLine,
  'audio-lines': AudioLines,
  'layers-3': Layers3,
  'layout-template': LayoutTemplate,
  'volume-2': Volume2,
  upload: Upload,
  package: Package
};

export default function InventoryProductIcon({ product, size = 32 }) {
  return createElement(icons[product?.metadata?.icon] || Package, { size, 'aria-hidden': true });
}
