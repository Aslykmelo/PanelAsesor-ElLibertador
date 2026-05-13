import { UserRole, ManagementType } from './constants';

export type TransferStatus = 'pendiente' | 'gestionado';

export interface Transfer {
  id?: string;
  type: 'mensaje' | 'regalo';
  managementType: ManagementType;
  
  fromAdvisorName: string;
  fromAdvisorEmail: string;
  
  toAdvisorName: string;
  toAdvisorEmail: string;
  
  supervisorEmail: string;
  supervisorName: string;
  cartera: string;
  
  requestNumber: string;
  customerName: string;
  phone: string;
  
  paymentLinkValue: number;
  observations?: string;
  
  status: TransferStatus;
  
  notified?: boolean;
  notifiedAt?: any;
  
  createdAt: any;
  updatedAt: any;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  supervisorEmail: string;
  supervisorName: string;
  cartera: string;
  photoURL?: string;
  createdAt: any;
  lastLoginAt?: any;
  status?: 'online' | 'offline';
}

export interface Advisor {
  id?: string;
  name: string;
  email: string;
  supervisor: string;
  supervisorEmail: string;
  cartera: string;
  role: string;
  active: boolean;
  createdAt: any;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
}
