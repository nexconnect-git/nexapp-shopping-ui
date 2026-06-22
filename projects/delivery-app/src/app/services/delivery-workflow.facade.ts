import { inject, Injectable } from '@angular/core';
import { DeliveryApi } from '@shared/public-api';

@Injectable({ providedIn: 'root' })
export class DeliveryWorkflowFacade {
  private readonly api = inject(DeliveryApi);

  loadDashboard() {
    return this.api.getDeliveryDashboard();
  }

  getRequests() {
    return this.api.getDeliveryRequests();
  }

  acceptRequest(assignmentId: string) {
    return this.api.acceptDeliveryRequest(assignmentId);
  }

  rejectRequest(assignmentId: string) {
    return this.api.rejectDeliveryRequest(assignmentId);
  }

  getHistory(params?: { status?: string | string[] }) {
    return this.api.getDeliveryHistory(params);
  }

  getEarnings() {
    return this.api.getDeliveryEarnings();
  }

  setAvailability(isOnline: boolean) {
    return this.api.setAvailability(isOnline);
  }

  setOnTheWay(orderId: string) {
    return this.api.setDeliveryOnTheWay(orderId);
  }

  cancelAssignment(orderId: string) {
    return this.api.cancelDeliveryAssignment(orderId);
  }

  getPaymentQR(orderId: string) {
    return this.api.getPaymentQR(orderId);
  }

  confirmDelivery(orderId: string, otp: string, photo: File) {
    return this.api.confirmDelivery(orderId, otp, photo);
  }
}
