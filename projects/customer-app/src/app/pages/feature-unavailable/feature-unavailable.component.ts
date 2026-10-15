import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PageFeatureAccessService } from '@shared/lib/services/page-feature-access.service';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
@Component({standalone:true,imports:[RouterLink,CustomerStateComponent],templateUrl:'./feature-unavailable.component.html'})
export class CustomerFeatureUnavailableComponent {
  readonly features=inject(PageFeatureAccessService);
  private readonly router=inject(Router);
  readonly maintenance=computed(()=>this.features.applications().global_settings?.['maintenanceMode']===true);
  retry():void {this.features.loadConfig(true,true).subscribe(()=>{if(!this.maintenance())this.router.navigate(['/']);});}
}
