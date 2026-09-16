export const TOOL_SHORTCUTS = {
  select: 'V',
  draw: 'P',
  eraser: 'E',
  image: 'I',
  shape: 'S / G',
  text: 'T',
  timer: 'R'
};

export const GUIDE_SHORTCUTS = {
  none: '0',
  'canva-guide.png': '1',
  'canva-guide2.png': '2',
  'canva-guide3.png': '3'
};

export const HOTKEY_SECTIONS = [
  {
    title: 'TOOLS',
    items: [
      ['V', 'Select / Move'],
      ['P', 'Brush'],
      ['E', 'Eraser'],
      ['I', 'Image / GIF'],
      ['S / G', 'Shapes'],
      ['T', 'Text'],
      ['R', 'Timer']
    ]
  },
  {
    title: 'CANVAS',
    items: [
      ['0', 'Guide off'],
      ['1 / 2 / 3', 'Guide 01 / 02 / 03'],
      ['ARROWS', 'Nudge selection 1 px'],
      ['SHIFT + ARROWS', 'Nudge selection 10 px'],
      ['ESC', 'Return to Select / clear selection'],
      ['DELETE', 'Delete selection']
    ]
  },
  {
    title: 'LAYERS + GROUPS',
    items: [
      ['CTRL/CMD + A', 'Select all visible layers'],
      ['CTRL/CMD + G', 'Group selection'],
      ['CTRL/CMD + SHIFT + G', 'Ungroup selection'],
      ['CTRL/CMD + D', 'Duplicate selection'],
      ['CTRL/CMD + ↑ / ↓', 'Move layer one level'],
      ['CTRL/CMD + SHIFT + DELETE', 'Purge canvas (confirm)']
    ]
  },
  {
    title: 'HISTORY + CLIPBOARD',
    items: [
      ['CTRL/CMD + Z', 'Undo'],
      ['CTRL/CMD + SHIFT + Z', 'Redo'],
      ['CTRL/CMD + Y', 'Redo'],
      ['CTRL/CMD + C', 'Copy'],
      ['CTRL/CMD + X', 'Cut'],
      ['CTRL/CMD + V', 'Paste']
    ]
  },
  {
    title: 'HELP',
    items: [
      ['?', 'Open / close hotkeys'],
      ['F1', 'Open / close hotkeys']
    ]
  }
];
