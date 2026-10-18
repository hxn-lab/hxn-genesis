/**
 * Keyboard shortcut registry and dispatcher for HXN GENESIS 3.0.
 */

export type ShortcutAction =
  | 'TOGGLE_PAUSE'
  | 'SINGLE_STEP'
  | 'TOGGLE_LEFT_PANEL'
  | 'TOGGLE_RIGHT_PANEL'
  | 'UNDO'
  | 'REDO'
  | 'TOGGLE_HELP'
  | 'TOGGLE_UI_MODE'
  | 'TOGGLE_GRID';

export interface ShortcutBinding {
  key: string;
  action: ShortcutAction;
  descriptionEn: string;
  descriptionVi: string;
}

export const KEYBOARD_SHORTCUTS: ShortcutBinding[] = [
  { key: 'Space', action: 'TOGGLE_PAUSE', descriptionEn: 'Pause / Resume simulation', descriptionVi: 'Tạm dừng / Tiếp tục mô phỏng' },
  { key: '.', action: 'SINGLE_STEP', descriptionEn: 'Advance single physics step', descriptionVi: 'Tiến thêm 1 bước vật lý' },
  { key: '[', action: 'TOGGLE_LEFT_PANEL', descriptionEn: 'Collapse / Expand Left Panel', descriptionVi: 'Ẩn / Hiện bảng điều khiển bên trái' },
  { key: ']', action: 'TOGGLE_RIGHT_PANEL', descriptionEn: 'Collapse / Expand Right Panel', descriptionVi: 'Ẩn / Hiện bảng viễn thám bên phải' },
  { key: 'z', action: 'UNDO', descriptionEn: 'Undo last God Mode action', descriptionVi: 'Hoàn tác thao tác trước' },
  { key: 'y', action: 'REDO', descriptionEn: 'Redo action', descriptionVi: 'Làm lại thao tác' },
  { key: 'h', action: 'TOGGLE_HELP', descriptionEn: 'Open / Close Help & Shortcuts', descriptionVi: 'Mở / Đóng bảng Trợ giúp & Phím tắt' },
  { key: 'm', action: 'TOGGLE_UI_MODE', descriptionEn: 'Switch Creator / Advanced UI Mode', descriptionVi: 'Chuyển chế độ Sáng tạo / Chuyên sâu' },
  { key: 'g', action: 'TOGGLE_GRID', descriptionEn: 'Toggle 3D Lat/Lon Graticule & Axis', descriptionVi: 'Bật / Tắt lưới kinh vĩ độ & trục nghiêng 3D' }
];

export function resolveShortcutAction(key: string, code: string): ShortcutAction | null {
  if (code === 'Space' || key === ' ') return 'TOGGLE_PAUSE';
  const k = key.toLowerCase();
  if (k === '.') return 'SINGLE_STEP';
  if (k === '[') return 'TOGGLE_LEFT_PANEL';
  if (k === ']') return 'TOGGLE_RIGHT_PANEL';
  if (k === 'z') return 'UNDO';
  if (k === 'y') return 'REDO';
  if (k === 'h' || k === '?') return 'TOGGLE_HELP';
  if (k === 'm') return 'TOGGLE_UI_MODE';
  if (k === 'g') return 'TOGGLE_GRID';
  return null;
}
