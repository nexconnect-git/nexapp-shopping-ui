import { Component, inject, OnInit, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AlertService, ApiService } from '@shared/public-api';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

interface PredefinedQuestion {
  id: string;
  text: string;
}

@Component({
  selector: 'app-order-help',
  standalone: true,
  imports: [CommonModule, RouterModule,],
  templateUrl: './order-help.component.html',
  styleUrls: ['./order-help.component.scss']
})
export class OrderHelpComponent implements OnInit, AfterViewChecked {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private alerts = inject(AlertService);

  orderId = signal<string>('');
  order = signal<any>(null);
  loading = signal(true);

  messages = signal<ChatMessage[]>([]);
  isBotTyping = signal(false);

  @ViewChild('chatWindow') chatWindow!: ElementRef;

  predefinedQuestions: PredefinedQuestion[] = [
    { id: 'status', text: 'Where is my order?' },
    { id: 'address', text: 'Can I change my delivery address?' },
    { id: 'cancel', text: 'How do I cancel this order?' },
    { id: 'issue', text: 'I have an issue with the items.' },
  ];

  canTrackOrder() {
    const status = this.order()?.status;
    return !!status && ['confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way'].includes(status);
  }

  canRaiseIssue() {
    const status = this.order()?.status;
    return !!status && ['delivered', 'cancelled'].includes(status);
  }

  openTracking() {
    this.router.navigate(['/order', this.orderId(), 'tracking']);
  }

  openOrderDetail() {
    this.router.navigate(['/order', this.orderId()]);
  }

  openIssueFlow() {
    this.router.navigate(['/order', this.orderId(), 'issue']);
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.orderId.set(id);
        this.loadOrder(id);
      }
    });

    // Initial bot welcome message
    this.messages.update(m => [...m, {
      sender: 'bot',
      text: 'Hello! I am the NexConnect Support Assistant. How can I help you with this order?',
      timestamp: new Date()
    }]);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom() {
    try {
      if (this.chatWindow) {
        this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
      }
    } catch (err) { }
  }

  loadOrder(id: string) {
    this.api.getOrder(id).subscribe({
      next: (res: any) => {
        this.order.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.alerts.error('Failed to load order context.');
        this.loading.set(false);
      }
    });
  }

  sendQuestion(q: PredefinedQuestion) {
    // Add user message
    this.messages.update(m => [...m, {
      sender: 'user',
      text: q.text,
      timestamp: new Date()
    }]);

    this.isBotTyping.set(true);

    // Simulate network delay
    setTimeout(() => {
      let replyText = 'I am unable to determine the status of this order right now. Please try again later.';
      const currentOrder = this.order();

      if (currentOrder) {
        switch (q.id) {
          case 'status':
            if (currentOrder.status === 'delivered') {
              replyText = `This order was successfully delivered on ${new Date(currentOrder.updated_at).toLocaleDateString()}.`;
            } else if (currentOrder.status === 'cancelled') {
              replyText = 'This order has been cancelled.';
            } else if (currentOrder.status === 'on_the_way' || currentOrder.status === 'picked_up') {
              replyText = 'Your order is on the way! You can track the delivery partner on the map via the tracking page.';
            } else {
              replyText = `Your order is currently marked as '${currentOrder.status.replace('_', ' ')}'. It is being reviewed by the vendor.`;
            }
            break;
          case 'address':
            if (['placed', 'confirmed', 'preparing'].includes(currentOrder.status)) {
              replyText = 'Since your order has not been dispatched yet, you can contact the vendor directly to request an address change. We cannot change it from here once placed.';
            } else {
              replyText = 'Unfortunately, your order has already been dispatched. Address changes are no longer possible.';
            }
            break;
          case 'cancel':
            if (['placed'].includes(currentOrder.status)) {
              replyText = 'Since your order was just placed, you may be able to cancel it from the order details page. If the vendor accepts it, cancellation option might be removed.';
            } else {
              replyText = 'Cancellation is not available for orders currently in progress. Please refuse delivery or contact support for a return once it arrives.';
            }
            break;
          case 'issue':
            replyText = 'We are sorry there is an issue with your items! Please take pictures of the affected items and create a return/refund request from the order page, or contact our human support at 1-800-NXC-HELP.';
            break;
        }
      }

      this.messages.update(m => [...m, {
        sender: 'bot',
        text: replyText,
        timestamp: new Date()
      }]);
      this.isBotTyping.set(false);
    }, 1000); // 1-second delay
  }
}
