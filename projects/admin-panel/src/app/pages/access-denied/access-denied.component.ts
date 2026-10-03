import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({ selector:'app-access-denied', standalone:true, imports:[RouterLink], template:`<section class="admin-panel"><h1>Access required</h1><p>Your account does not have permission for this page. Ask a super administrator to review your access.</p><a class="btn btn-primary" routerLink="/admin/profile">Open my profile</a></section>` })
export class AccessDeniedComponent {}
