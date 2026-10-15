import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
@Component({
  standalone: true,
  imports: [RouterLink, CustomerStateComponent],
  templateUrl: './not-found.component.html',
})
export class CustomerNotFoundComponent {}
