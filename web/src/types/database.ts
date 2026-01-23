// =====================================================
// PLAYBOOK SYSTEM - DATABASE TYPES
// Description: TypeScript types matching the database schema
// =====================================================

// Enums
export type UserRole = 'manager' | 'trainer';
export type StudentStatus = 'active' | 'cancelled' | 'paused';
export type StudentOrigin = 'organic' | 'referral' | 'marketing';
export type CalculationType = 'weighted' | 'fixed';
export type EventType = 'status_change' | 'trainer_change' | 'origin_update';

// KPI Configuration in game_rules
export interface KPIConfig {
  min_portfolio_size: number;
  referral_validation_days: number;
  retention: {
    enabled: boolean;
    target: number;
    weight: number;
    fixed_value: number;
  };
  referrals: {
    enabled: boolean;
    target: number;
    weight: number;
    fixed_value: number;
  };
  management: {
    enabled: boolean;
    target: number;
    weight: number;
    fixed_value: number;
    window_days?: number;
  };
}

// Database Tables
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trainer {
  id: string;
  profile_id: string;
  start_date: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  profile?: Profile;
}

export interface Student {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  trainer_id: string;
  status: StudentStatus;
  origin: StudentOrigin;
  referred_by_trainer_id: string | null;
  start_date: string;
  end_date: string | null;
  referral_validated_at: string | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  trainer?: Trainer;
  referred_by_trainer?: Trainer;
}

export interface StudentEvent {
  id: string;
  student_id: string;
  event_type: EventType;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  event_date: string;
  created_by: string | null;
}

// Protocols Management Types
export type AssessmentPillar = 'composition' | 'neuromuscular' | 'specific' | 'rom';

export interface AssessmentProtocol {
  id: string;
  name: string;
  pillar: AssessmentPillar;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  // Joined fields
  metrics?: ProtocolMetric[];
}

export interface ProtocolMetric {
  id: string;
  protocol_id: string;
  name: string;
  unit: string;
  display_order: number;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
}

export interface StudentAssessment {
  id: string;
  student_id: string;
  protocol_id: string;
  performed_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  // Joined fields
  protocol?: AssessmentProtocol & { metrics: ProtocolMetric[] };
  results?: AssessmentResult[];
  creator?: Profile;
}

export interface AssessmentResult {
  id: string;
  assessment_id: string;
  metric_id: string;
  value: number;
  created_at: string;
  // Joined fields
  metric?: ProtocolMetric;
}

export interface GameRule {
  id: string;
  name: string;
  description: string | null;
  effective_from: string;
  effective_until: string | null;
  calculation_type: CalculationType;
  kpi_config: KPIConfig;
  base_reward_amount: number;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface PerformanceSnapshot {
  id: string;
  trainer_id: string;
  reference_month: string;
  // KPI 01: Retention
  students_start: number;
  students_end: number;
  cancellations: number;
  retention_rate: number;
  retention_target: number;
  retention_eligible: boolean;
  retention_achieved: boolean;
  // KPI 02: Referrals
  referrals_count: number;
  referrals_target: number;
  referrals_achieved: boolean;
  // KPI 03: Management
  portfolio_size: number;
  managed_count: number;
  management_rate: number;
  management_target: number;
  management_achieved: boolean;
  // Reward
  game_rule_id: string | null;
  reward_amount: number;
  // Control
  is_finalized: boolean;
  finalized_at: string | null;
  finalized_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  trainer?: Trainer;
  game_rule?: GameRule;
}

// Dashboard Data (from function)
export interface TrainerDashboardData {
  reference_month: string;
  // Retention
  students_start: number;
  students_end: number;
  cancellations: number;
  retention_rate: number;
  retention_target: number;
  retention_eligible: boolean;
  retention_achieved: boolean;
  // Referrals
  referrals_count: number;
  referrals_target: number;
  referrals_achieved: boolean;
  referrals_pending: number;
  // Management
  portfolio_size: number;
  managed_count: number;
  management_rate: number;
  management_target: number;
  management_achieved: boolean;
  // Reward
  reward_amount: number;
  is_finalized: boolean;
}

// Form Types
export interface CreateStudentInput {
  full_name: string;
  email?: string;
  phone?: string;
  trainer_id: string;
  origin: StudentOrigin;
  referred_by_trainer_id?: string;
  start_date?: string;
  notes?: string;
}

export interface UpdateStudentInput {
  full_name?: string;
  email?: string;
  phone?: string;
  trainer_id?: string;
  origin?: StudentOrigin;
  referred_by_trainer_id?: string;
  status?: StudentStatus;
  notes?: string;
  end_date?: string;
  is_archived?: boolean;
}

export interface CreateTrainerInput {
  email: string;
  full_name: string;
  start_date?: string;
  notes?: string;
}

export interface CreateProtocolInput {
  name: string;
  pillar: AssessmentPillar;
  description?: string;
  metrics: {
    name: string;
    unit: string;
    is_required: boolean;
  }[];
}

export interface UpdateProtocolInput {
  id: string;
  name: string;
  pillar: AssessmentPillar;
  description?: string;
  metrics: {
    id?: string;
    name: string;
    unit: string;
    is_required: boolean;
    is_active?: boolean;
  }[];
}

export interface CreateAssessmentInput {
  student_id: string;
  protocol_id: string;
  performed_at: string;
  notes?: string;
  results: {
    metric_id: string;
    value: number;
  }[];
}

export interface CreateGameRuleInput {
  name: string;
  description?: string;
  effective_from: string;
  effective_until?: string;
  calculation_type: CalculationType;
  kpi_config: KPIConfig;
  base_reward_amount: number;
}
