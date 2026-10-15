import { definePreset } from '@primeuix/themes';
import AuraBase from '@primeuix/themes/aura/base';
import AuraButton from '@primeuix/themes/aura/button';
import AuraDialog from '@primeuix/themes/aura/dialog';
// Only load component tokens used by Counter's modal surfaces.
export const CounterTheme = definePreset(AuraBase, {
  components: { button: AuraButton, dialog: AuraDialog },
}, {
  semantic: {
    primary: { 50: '#eee9ff', 100: '#ded5fa', 200: '#c3b7ef', 300: '#a293e9', 400: '#7c65e0', 500: '#5740cf', 600: '#4731b9', 700: '#392794', 800: '#302378', 900: '#29205e', 950: '#211a44' },
    colorScheme: { light: {
      surface: { 0: '#fffefa', 50: '#f5f4ee', 100: '#f1f2e9', 200: '#e8eadf', 300: '#dcded4', 400: '#ccd1c1', 500: '#828e77', 600: '#697165', 700: '#53604b', 800: '#313c1e', 900: '#232722', 950: '#1b1f1a' },
      primary: { color: '#5740cf', contrastColor: '#ffffff', hoverColor: '#4731b9', activeColor: '#392794' },
    } },
  },
  components: { dialog: { root: { borderRadius: '20px', background: '#fffefa', borderColor: '#dcded4' }, header: { padding: '26px 28px 18px' }, content: { padding: '0 28px 28px' } } },
});
