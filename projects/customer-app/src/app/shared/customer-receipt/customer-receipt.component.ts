import { CustomerCurrencyPipe } from '../customer-currency/customer-currency.pipe';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnDestroy, Output, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NxModalShellComponent } from '../ui/nx-modal-shell/nx-modal-shell.component';
import { CustomerIconComponent } from '../customer-icon/customer-icon.component';
import { CustomerOrderApiService } from '../../services/customer-order-api.service';
import { AuthService } from '../../services/auth.service';
@Component({selector:'fd-customer-receipt',standalone:true,imports:[NxModalShellComponent,CustomerIconComponent,CustomerCurrencyPipe],templateUrl:'./customer-receipt.component.html',styleUrl:'./customer-receipt.component.scss'})
export class CustomerReceiptComponent implements OnChanges,OnDestroy {
  @Input() open=false;
  @Input() orderId='';
  @Input() orderNumber='';
  @Input() invoiceId='';
  @Input() order:any=null;
  @Output() closed=new EventEmitter<void>();
  @Output() failed=new EventEmitter<string>();
  @Output() downloaded=new EventEmitter<void>();
  @Output() recovered=new EventEmitter<void>();
  readonly loading=signal(false);
  readonly error=signal('');
  readonly ready=signal(false);
  readonly invoice=signal<any|null>(null);
  private readonly api=inject(CustomerOrderApiService);
  private readonly auth=inject(AuthService);
  private readonly destroyRef=inject(DestroyRef);
  private session=this.auth.sessionVersion;
  private request=0;
  private documentUrl='';
  private loadedKey='';
  constructor(){effect(()=>{this.auth.currentUser();if(this.session===this.auth.sessionVersion)return;this.session=this.auth.sessionVersion;this.loadedKey='';this.reset();this.closed.emit();});}
  ngOnChanges():void {if(!this.open){this.loadedKey='';this.reset();return;}if(this.loadedKey!==this.orderId+'|'+this.invoiceId)this.load();}
  ngOnDestroy():void {this.reset();}
  private reset():void {++this.request;this.loading.set(false);this.error.set('');this.ready.set(false);this.invoice.set(null);if(this.documentUrl)URL.revokeObjectURL(this.documentUrl);this.documentUrl='';}
  load():void {
    this.reset();
    this.loadedKey=this.orderId+'|'+this.invoiceId;
    if(!this.open||!this.auth.isLoggedIn()||!this.orderId||this.orderId==='loading')return;
    const request=++this.request,session=this.auth.sessionVersion,id=this.orderId;
    const current=()=>request===this.request&&session===this.auth.sessionVersion&&id===this.orderId&&this.open&&!this.destroyRef.destroyed;
    this.loading.set(true);
    const fail=()=>{if(!current())return;const message='Your receipt could not be generated or downloaded. Your order is unchanged. Retry the owned receipt request.';this.loading.set(false);this.error.set(message);this.failed.emit(message);};
    const read=(invoiceId:string)=>{if(!current())return;this.api.downloadInvoice(invoiceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:async blob=>{try{if(!current())return;const header=await blob.slice(0,5).text();if(!current())return;if(header!=='%PDF-'){fail();return;}this.documentUrl=URL.createObjectURL(blob);this.ready.set(true);this.loading.set(false);this.recovered.emit();}catch{fail();}},error:fail});};
    if(this.invoiceId){read(this.invoiceId);return;}
    this.api.generateInvoice({order:id,invoice_type:'customer_receipt'}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:(invoice:any)=>{if(!current())return;const invoiceId=String(invoice?.id||'').trim();if(!invoiceId){fail();return;}this.invoice.set(invoice);read(invoiceId);},error:fail});
  }
  itemAmount(item:any):string|number|null {
    if(item.raw?.subtotal!==undefined&&item.raw?.subtotal!==null)return item.raw.subtotal;
    const quantity=Number(item.raw?.quantity??item.quantity);
    return Number.isFinite(quantity)&&quantity>0 ? item.price*quantity : null;
  }
  download():void {
    if(!this.documentUrl||!this.auth.isLoggedIn()||this.loading())return;
    const anchor=document.createElement('a');anchor.href=this.documentUrl;anchor.download=('receipt-'+(this.orderNumber||this.orderId)+'.pdf').replace(/[^\w.-]+/g,'_');anchor.click();this.downloaded.emit();
  }
}
