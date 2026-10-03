import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { AdminConfirmService } from '../services/admin-confirm.service';
export const unsavedChangesGuard:CanDeactivateFn<{hasUnsavedChanges?:()=>boolean}> = component => !component.hasUnsavedChanges?.() || inject(AdminConfirmService).ask('Discard unsaved changes?','Your changes have not been saved. Leave this page and discard them?','Discard changes');
