export type UserType = 'escort' | 'client' | 'admin';
export type UserStatus = 'active' | 'blocked' | 'pending';
export type VerificationStatus = 'verified' | 'pending' | 'unverified';
export type BodyType = 'magro' | 'atlético' | 'forte' | 'musculoso';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: UserType;
  status: UserStatus;
  createdAt: string;
  lastAccess: string;
}

export interface EscortProfile {
  id: string; // Same as userId
  userId: string;
  artisticName: string;
  age: number;
  height?: number;
  weight?: number;
  bodyType?: BodyType;
  eyeColor?: string;
  hairColor?: string;
  city: string;
  bio?: string;
  languages?: string[];
  availability?: string;
  verified: VerificationStatus;
  verificationDate?: string;
  verificationDocumentUrl?: string;
  views: number;
  rating: number;
  mainPhotoUrl?: string;
  photos?: Photo[];
  socialLinks?: {
    instagram?: string;
    facebook?: string;
  };
}

export interface Price {
  id: string;
  escortId: string;
  service: string;
  value: string;
  description?: string;
}

export interface Photo {
  id: string;
  escortId: string;
  url: string;
  isMain: boolean;
  isApproved: boolean;
  order: number;
  uploadedAt: string;
}

export interface Review {
  id: string;
  clientId: string;
  escortId: string;
  stars: number;
  comment: string;
  date: string;
  isConfirmed: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  isReported: boolean;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  type: string;
  reason: string;
  description: string;
  status: ReportStatus;
  resolvedBy?: string;
  createdAt: string;
}

export interface Favorite {
  id: string;
  clientId: string;
  escortId: string;
  createdAt: string;
}
