import { CounterStateComponent } from '../../components/counter-state.component';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppCurrencyPipe, VendorTransaction, VendorWorkspaceApi } from '@shared/public-api';
import { VendorContextService } from '../../services/vendor-context.service';
import { vendorListState } from '../../services/vendor-list-state';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';

@Component({selector:'app-transactions',standalone:true,imports:[CounterStateComponent,CommonModule,FormsModule,RouterLink,AppCurrencyPipe,WorkspacePagerComponent],templateUrl:'./transactions.component.html',styleUrl:'./transactions.component.scss'})
export class TransactionsComponent implements OnInit {
  private readonly api=inject(VendorWorkspaceApi);private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);private readonly destroy=inject(DestroyRef);
  readonly context=inject(VendorContextService);
  readonly list=vendorListState<VendorTransaction>(query=>this.api.transactions(query));search='';type='';source='';
  ngOnInit():void{this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params=>{this.list.page.set(Math.max(1,Number(params.get('page'))||1));this.search=params.get('search')||'';this.type=params.get('type')||'';this.source=params.get('source')||'';this.list.load({search:this.search,transaction_type:this.type,source:this.source});});}
  query(page=1):void{void this.router.navigate([],{queryParams:{page,search:this.search||null,type:this.type||null,source:this.source||null}});}
  sourceLabel(value:string):string{return value.replaceAll('_',' ');}
}
