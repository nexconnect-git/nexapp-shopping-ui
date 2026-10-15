// PrimeUIX 3.0.1 exports the base preset at runtime but omits its default
// declaration. Keep the workaround scoped to the vendor application.
declare module '@primeuix/themes/aura/base' {
  import type { Preset } from '@primeuix/themes/types';
  const base: Preset;
  export default base;
}
