// =====================================================
// PLAYBOOK SYSTEM - DATABASE TYPES
// Description: TypeScript types matching the database schema
// =====================================================

// Enums
export type UserRole = 'manager' | 'trainer' | 'professional';
export type ProfessionType = 'trainer' | 'nutritionist' | 'physiotherapist';
export type StudentStatus = 'active' | 'cancelled' | 'paused';
export type StudentOrigin = 'organic' | 'referral' | 'marketing';
export type CalculationType = 'weighted' | 'fixed';
export type EventType = 'status_change' | 'trainer_change' | 'origin_update';
export type AttendanceStatus = 'pending' | 'present' | 'absent';

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
  profession_type: ProfessionType | null;
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

export interface WeeklyScheduleTemplate {
  id: string;
  student_id: string | null;
  guest_name: string | null;
  guest_origin: string | null;
  trainer_id: string;
  weekday: number;
  start_time: string;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  student?: Student & { trainer?: Trainer & { profile?: Profile } };
  trainer?: Trainer & { profile?: Profile };
}

export interface AttendanceRecord {
  id: string;
  schedule_template_id: string;
  student_id: string | null;
  guest_name: string | null;
  guest_origin: string | null;
  trainer_id: string;
  session_date: string;
  start_time: string;
  status: AttendanceStatus;
  notes: string | null;
  marked_by: string | null;
  marked_at: string | null;
  created_at: string;
  updated_at: string;
  student?: Student & { trainer?: Trainer & { profile?: Profile } };
  trainer?: Trainer & { profile?: Profile };
}

export interface AttendancePublicLink {
  id: string;
  label: string;
  access_token: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleParticipant {
  id?: string;
  student_id?: string;
  guest_name?: string;
  guest_origin?: string;
  position: number;
  status?: AttendanceStatus;
  notes?: string;
}

export interface ScheduleBaseSlot {
  id: string;
  trainer_id: string;
  weekday: number;
  start_time: string;
  capacity: number;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  trainer?: Trainer & { profile?: Profile };
  entries?: ScheduleBaseEntry[];
}

export interface ScheduleBaseEntry {
  id: string;
  slot_id: string;
  student_id: string | null;
  guest_name: string | null;
  guest_origin: string | null;
  position: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: Student & { trainer?: Trainer & { profile?: Profile } };
}

export interface ScheduleWeekSlot {
  id: string;
  base_slot_id: string | null;
  trainer_id: string;
  week_start: string;
  weekday: number;
  start_time: string;
  capacity: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  trainer?: Trainer & { profile?: Profile };
  entries?: ScheduleWeekEntry[];
}

export interface ScheduleWeekEntry {
  id: string;
  week_slot_id: string;
  student_id: string | null;
  guest_name: string | null;
  guest_origin: string | null;
  position: number;
  status: AttendanceStatus;
  notes: string | null;
  marked_by: string | null;
  marked_at: string | null;
  created_at: string;
  updated_at: string;
  student?: Student & { trainer?: Trainer & { profile?: Profile } };
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

export interface AssessmentAttachment {
  id: string;
  assessment_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
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
  attachments?: AssessmentAttachment[];
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
  attachments?: {
    file_path: string;
    file_name: string;
    file_type: string;
    file_size: number;
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

export interface UpsertWeeklyScheduleInput {
  id?: string;
  student_id?: string;
  guest_name?: string;
  guest_origin?: string;
  trainer_id?: string;
  weekday: number;
  start_time: string;
  notes?: string;
}

export interface SetAttendanceStatusInput {
  schedule_template_id: string;
  session_date: string;
  status: AttendanceStatus;
}

export interface UpsertScheduleSlotInput {
  slot_id?: string;
  trainer_id?: string;
  weekday: number;
  start_time: string;
  capacity: number;
  notes?: string;
  week_start?: string;
  batch_slots?: {
    start_time: string;
    capacity: number;
  }[];
  entries: ScheduleParticipant[];
}

// Activity Tracking
export type TrainerActivityType =
  | 'login'
  | 'result_management'
  | 'student_status_update'
  | 'referral_registered'
  | 'student_registered'
  | 'schedule_update'
  | 'student_archived';

export interface TrainerActivitySummary {
  trainer_id: string;
  trainer_name: string;
  last_login: string | null;
  last_result_management: string | null;
  last_student_status_update: string | null;
  last_referral_registered: string | null;
  last_student_registered: string | null;
  last_schedule_update: string | null;
  last_student_archived: string | null;
}

// === EQUIPE UNIFICADA ===

export interface TeamMember {
    id: string;           // trainer.id ou professional.id
    profileId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    type: 'trainer' | 'nutritionist' | 'physiotherapist';
    startDate: string;
    isActive: boolean;
    notes: string | null;
    activeStudents: number;
    trainerId?: string;   // Apenas para treinadores (para ações de KPI)
}

// === ECOSSISTEMA MULTIDISCIPLINAR ===

export interface Professional {
    id: string;
    profile_id: string;
    profession_type: ProfessionType;
    start_date: string;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    profile?: Profile;
}

export type StudentProfessionalStatus = 'active' | 'inactive';

export interface StudentProfessional {
    id: string;
    student_id: string;
    professional_id: string;
    status: StudentProfessionalStatus;
    started_at: string;
    ended_at: string | null;
    notes: string | null;
    created_at: string;
    // Joined fields
    student?: Student;
    professional?: Professional;
}

export interface CreateProfessionalInput {
    email: string;
    full_name: string;
    password: string;
    profession_type: ProfessionType;
    start_date?: string;
    notes?: string;
}

// === MÓDULO NUTRIÇÃO ===

export type NutritionConsultationType = 'initial_assessment' | 'follow_up' | 'reassessment';

export interface NutritionConsultation {
    id: string;
    student_id: string;
    professional_id: string;
    consultation_date: string;
    consultation_type: NutritionConsultationType;
    chief_complaint: string | null;
    clinical_notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    student?: Student;
    anamnesis?: NutritionAnamnesis;
    metrics?: NutritionMetrics;
}

export interface NutritionAnamnesis {
    id: string;
    consultation_id: string;
    dietary_history: string | null;
    food_allergies: string[];
    food_intolerances: string[];
    supplements: string[];
    pathologies: string[];
    medications: string[];
    objective: string | null;
    daily_routine: string | null;
    water_intake_ml: number | null;
    bowel_habits: string | null;
    sleep_quality: string | null;
    additional_notes: string | null;
    created_at: string;
}

export interface NutritionMetrics {
    id: string;
    consultation_id: string;
    weight_kg: number | null;
    height_cm: number | null;
    bmi: number | null;
    body_fat_pct: number | null;
    lean_mass_kg: number | null;
    waist_cm: number | null;
    hip_cm: number | null;
    arm_cm: number | null;
    thigh_cm: number | null;
    chest_cm: number | null;
    calf_cm: number | null;
    visceral_fat_level: number | null;
    basal_metabolic_rate: number | null;
    additional_measures: Record<string, unknown>;
    created_at: string;
}

export interface MealPlanItem {
    food: string;
    quantity: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
}

export interface MealPlanMeal {
    name: string;
    time: string;
    items: MealPlanItem[];
    notes?: string;
}

export interface NutritionMealPlan {
    id: string;
    student_id: string;
    professional_id: string;
    title: string;
    objective: string | null;
    total_calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    notes: string | null;
    meals: MealPlanMeal[];
    created_at: string;
    updated_at: string;
    // Joined fields
    student?: Student;
}

export interface LabResultEntry {
    value: number;
    unit: string;
    reference: string;
    status: 'normal' | 'low' | 'high';
}

export interface NutritionLabResult {
    id: string;
    student_id: string;
    professional_id: string;
    exam_date: string;
    exam_type: string;
    results: Record<string, LabResultEntry>;
    file_path: string | null;
    file_type: string | null;
    file_size: number | null;
    notes: string | null;
    created_at: string;
}

export interface CreateNutritionConsultationInput {
    student_id: string;
    consultation_date?: string;
    consultation_type: NutritionConsultationType;
    chief_complaint?: string;
    clinical_notes?: string;
    anamnesis?: Omit<NutritionAnamnesis, 'id' | 'consultation_id' | 'created_at'>;
    metrics?: Omit<NutritionMetrics, 'id' | 'consultation_id' | 'created_at'>;
}

export interface CreateMealPlanInput {
    student_id: string;
    title: string;
    objective?: string;
    total_calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    start_date: string;
    end_date?: string;
    notes?: string;
    meals: MealPlanMeal[];
}

export interface CreateLabResultInput {
    student_id: string;
    exam_date: string;
    exam_type: string;
    results: Record<string, LabResultEntry>;
    notes?: string;
}

// === MÓDULO FISIOTERAPIA ===

export type PhysioSessionType = 'initial_assessment' | 'treatment' | 'reassessment' | 'discharge';
export type PhysioMetricType = 'rom' | 'strength' | 'pain' | 'functional_test' | 'posture' | 'gait' | 'balance';
export type PhysioBodySide = 'left' | 'right' | 'bilateral' | 'midline';
export type PhysioTreatmentStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface PhysioSession {
    id: string;
    student_id: string;
    professional_id: string;
    session_date: string;
    session_type: PhysioSessionType;
    clinical_notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    student?: Student;
    anamnesis?: PhysioAnamnesis;
    metrics?: PhysioMetric[];
    evolution?: PhysioSessionEvolution;
}

export interface PhysioAnamnesis {
    id: string;
    session_id: string;
    chief_complaint: string | null;
    pain_location: string[];
    pain_intensity: number | null;
    pain_type: string | null;
    onset_date: string | null;
    aggravating_factors: string[];
    relieving_factors: string[];
    medical_history: string | null;
    surgical_history: string | null;
    medications: string[];
    imaging_results: string | null;
    functional_limitations: string | null;
    previous_treatments: string | null;
    additional_notes: string | null;
    created_at: string;
}

export interface PhysioMetric {
    id: string;
    session_id: string;
    metric_type: PhysioMetricType;
    body_region: string;
    movement: string | null;
    value: number | null;
    unit: string | null;
    side: PhysioBodySide | null;
    is_within_normal: boolean | null;
    reference_value: string | null;
    notes: string | null;
    created_at: string;
}

export interface PhysioExercise {
    name: string;
    sets: number;
    reps: string;
    load: string | null;
    notes?: string;
    progression?: string;
}

export interface PhysioModality {
    name: string;
    duration: string;
    area: string;
    frequency?: string;
    notes?: string;
}

export interface PhysioTreatmentPlan {
    id: string;
    student_id: string;
    professional_id: string;
    diagnosis: string;
    objectives: string[];
    contraindications: string[];
    estimated_sessions: number | null;
    frequency: string | null;
    start_date: string;
    end_date: string | null;
    status: PhysioTreatmentStatus;
    exercises: PhysioExercise[];
    modalities: PhysioModality[];
    notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    student?: Student;
}

export interface PhysioExercisePerformed {
    name: string;
    sets_done: number;
    reps_done: string;
    load_used: string | null;
    tolerance: string;
}

export interface PhysioHomeExercise {
    name: string;
    frequency: string;
    duration: string;
    notes?: string;
}

export interface PhysioSessionEvolution {
    id: string;
    session_id: string;
    treatment_plan_id: string | null;
    procedures_performed: string[];
    patient_response: string | null;
    pain_before: number | null;
    pain_after: number | null;
    exercises_performed: PhysioExercisePerformed[];
    home_exercises: PhysioHomeExercise[];
    next_session_plan: string | null;
    notes: string | null;
    created_at: string;
}

export interface PhysioAttachment {
    id: string;
    session_id: string | null;
    treatment_plan_id: string | null;
    student_id: string;
    file_path: string;
    file_type: string;
    file_size: number | null;
    description: string | null;
    created_at: string;
}

export interface CreatePhysioSessionInput {
    student_id: string;
    session_date?: string;
    session_type: PhysioSessionType;
    clinical_notes?: string;
    anamnesis?: Omit<PhysioAnamnesis, 'id' | 'session_id' | 'created_at'>;
    metrics?: Omit<PhysioMetric, 'id' | 'session_id' | 'created_at'>[];
    evolution?: Omit<PhysioSessionEvolution, 'id' | 'session_id' | 'created_at'>;
}

export interface CreateTreatmentPlanInput {
    student_id: string;
    diagnosis: string;
    objectives: string[];
    contraindications?: string[];
    estimated_sessions?: number;
    frequency?: string;
    start_date: string;
    end_date?: string;
    exercises?: PhysioExercise[];
    modalities?: PhysioModality[];
    notes?: string;
}
