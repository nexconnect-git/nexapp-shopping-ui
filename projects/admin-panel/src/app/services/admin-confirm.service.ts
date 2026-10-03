import { Injectable, signal } from '@angular/core';
@Injectable({providedIn:'root'})
export class AdminConfirmService {
  visible=signal(false);title='';message='';label='Confirm';private resolve?: (confirmed:boolean)=>void;
  ask(title:string,message:string,label='Confirm'):Promise<boolean>{this.finish(false);this.title=title;this.message=message;this.label=label;this.visible.set(true);return new Promise(resolve=>this.resolve=resolve);}
  finish(confirmed:boolean){this.visible.set(false);this.resolve?.(confirmed);this.resolve=undefined;}
}
