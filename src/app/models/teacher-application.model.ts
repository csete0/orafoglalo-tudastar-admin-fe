export interface RejectTeacherApplicationRequest {
  reason?: string;
}

export interface TeacherApplicationAdminDto {
  id: number;
  userId: number;
  applicantName: string;
  applicantEmail: string;
  motivation: string;
  institutionName?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  decidedAt?: string;
  rejectionReason?: string;
}
