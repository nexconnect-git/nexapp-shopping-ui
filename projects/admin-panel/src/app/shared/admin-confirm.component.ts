import { Component, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { AdminConfirmService } from '../services/admin-confirm.service';
@Component({selector:'app-admin-confirm',standalone:true,imports:[DialogModule],template:`<p-dialog closeAriaLabel="Close dialog" [header]="confirmation.title" [visible]="confirmation.visible()" (visibleChange)="!$event && confirmation.finish(false)" [modal]="true" [style]="{width:'480px'}" [breakpoints]="{'768px':'94vw'}"><p>{{confirmation.message}}</p><ng-template #footer><button class="btn btn-secondary" (click)="confirmation.finish(false)">Cancel</button><button class="btn btn-primary" (click)="confirmation.finish(true)">{{confirmation.label}}</button></ng-template></p-dialog>`})
export class AdminConfirmComponent {confirmation=inject(AdminConfirmService);}
