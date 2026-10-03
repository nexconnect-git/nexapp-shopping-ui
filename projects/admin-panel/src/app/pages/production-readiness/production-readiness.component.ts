import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
@Component({selector:'app-production-readiness',standalone:true,imports:[CommonModule,RouterLink],templateUrl:'./production-readiness.component.html',styleUrl:'./production-readiness.component.scss'})
export class ProductionReadinessComponent implements OnInit {
  private api=inject(ApiService);data=signal<any>(null);loading=signal(false);error=signal('');
  ngOnInit(){this.load();}load(){this.loading.set(true);this.error.set('');this.api.getAdminRuntimeReadiness().subscribe({next:response=>{this.data.set(response);this.loading.set(false)},error:()=>{this.error.set('Runtime checks could not be loaded.');this.loading.set(false)}});}
}