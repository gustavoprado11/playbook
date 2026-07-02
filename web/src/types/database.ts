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
  trainer_id: string | null;
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

export type AgendaKind = 'training' | 'physiotherapy';
export type AgendaSessionType = 'avaliacao' | 'recovery' | 'sessao';

export interface AttendancePublicLink {
  id: string;
  label: string;
  access_token: string;
  is_active: boolean;
  agenda: AgendaKind;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhysioScheduleBaseSlot {
  id: string;
  professional_id: string;
  weekday: number;
  start_time: string;
  capacity: number;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  professional?: Professional & { profile?: Profile };
  entries?: PhysioScheduleBaseEntry[];
}

export interface PhysioScheduleBaseEntry {
  id: string;
  slot_id: string;
  student_id: string | null;
  guest_name: string | null;
  guest_origin: string | null;
  position: number;
  session_type: AgendaSessionType;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: Student & { trainer?: Trainer & { profile?: Profile } };
}

export interface PhysioScheduleWeekSlot {
  id: string;
  base_slot_id: string | null;
  professional_id: string;
  week_start: string;
  weekday: number;
  start_time: string;
  capacity: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  professional?: Professional & { profile?: Profile };
  entries?: PhysioScheduleWeekEntry[];
}

export interface PhysioScheduleWeekEntry {
  id: string;
  week_slot_id: string;
  student_id: string | null;
  guest_name: string | null;
  guest_origin: string | null;
  position: number;
  status: AttendanceStatus;
  session_type: AgendaSessionType;
  notes: string | null;
  marked_by: string | null;
  marked_at: string | null;
  created_at: string;
  updated_at: string;
  student?: Student & { trainer?: Trainer & { profile?: Profile } };
}

export interface ScheduleParticipant {
  id?: string;
  student_id?: string;
  guest_name?: string;
  guest_origin?: string;
  position: number;
  status?: AttendanceStatus;
  session_type?: AgendaSessionType;
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
  agenda?: AgendaKind;
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
export type PhysioCareStatus = 'in_treatment' | 'discharged';

export interface PhysioEvolution {
    id: string;
    student_id: string;
    professional_id: string;
    body: string;
    created_at: string;
    updated_at: string;
    professional?: { full_name: string };
}

export interface StudentProfessional {
    id: string;
    student_id: string;
    professional_id: string;
    status: StudentProfessionalStatus;
    care_status?: PhysioCareStatus;
    discharged_at?: string | null;
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

// === FASE 3: COMUNICAÇÃO INTERDISCIPLINAR ===

export type ReferralType = 'referral' | 'request' | 'alert' | 'clearance';
export type ReferralPriority = 'low' | 'normal' | 'high';
export type ReferralStatus = 'pending' | 'accepted' | 'completed' | 'declined';

export interface ReferralParticipant {
    id: string;
    profession_type: ProfessionType;
    full_name: string;
}

export interface ReferralReply {
    id: string;
    referral_id: string;
    author_professional_id: string;
    body: string;
    created_at: string;
    author?: { full_name: string; profession_type: ProfessionType };
}

export interface InterdisciplinaryReferral {
    id: string;
    student_id: string;
    from_professional_id: string;
    to_professional_id: string;
    type: ReferralType;
    priority: ReferralPriority;
    subject: string;
    body: string | null;
    context_ref: { table: string; id: string } | null;
    status: ReferralStatus;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    // Joined fields
    student?: { id: string; full_name: string };
    from_professional?: ReferralParticipant;
    to_professional?: ReferralParticipant;
    replies?: ReferralReply[];
    reply_count?: number;
}

export type ClearanceLevel = 'cleared' | 'cleared_with_notes' | 'restricted' | 'contraindicated';
export type ClearanceStatus = 'active' | 'lifted' | 'expired';

export interface StudentClearance {
    id: string;
    student_id: string;
    issued_by_professional_id: string;
    clearance_level: ClearanceLevel;
    body_region: string | null;
    affected_movements: string[] | null;
    description: string;
    status: ClearanceStatus;
    effective_from: string;
    review_date: string | null;
    lifted_at: string | null;
    lifted_note: string | null;
    created_at: string;
    updated_at: string;
    issued_by?: { full_name: string; profession_type: ProfessionType };
}

export type SharedNoteCategory = 'general' | 'goal' | 'behavior' | 'logistics' | 'health';

export interface StudentSharedNote {
    id: string;
    student_id: string;
    author_professional_id: string | null;
    author_profile_id: string | null;
    category: SharedNoteCategory;
    body: string;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
    author?: { full_name: string; profession_type: ProfessionType | null; role: string };
}

export type NotificationType =
    | 'referral_received'
    | 'referral_replied'
    | 'referral_status_changed'
    | 'clearance_issued'
    | 'shared_note_added';

export interface AppNotification {
    id: string;
    recipient_profile_id: string;
    type: NotificationType;
    title: string;
    body: string | null;
    link: string | null;
    source_table: string | null;
    source_id: string | null;
    is_read: boolean;
    created_at: string;
    read_at: string | null;
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
    file_name: string | null;
    file_type: string;
    file_size: number | null;
    description: string | null;
    created_at: string;
    /** URL assinada gerada sob demanda em listPhysioAttachments (bucket privado). */
    signed_url?: string | null;
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

// =====================================================
// Workout Prescription Module (A0) — matches migrations 042/043
// =====================================================

// Fase = ritual de ordem fixa (Exos). Categoria (block_categories) é escopada por fase.
export type WorkoutPhase = 'preparacao_movimento' | 'potencia_forca' | 'dse' | 'regeneracao';

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface MovementPattern {
  pattern_key: string;
  label: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface BlockCategory {
  category_key: string;
  phase: WorkoutPhase;
  label: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface TrainingMethod {
  method_key: string;
  label: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  movement_pattern_key: string | null;
  default_category_key: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string | null;
  difficulty: ExerciseDifficulty | null;
  video_url: string | null;
  cues: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramTemplate {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  sessions?: SessionTemplate[];
}

export interface SessionTemplate {
  id: string;
  program_template_id: string;
  name: string;
  order_index: number;
  scheduled_days: number[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  blocks?: BlockTemplate[];
}

export interface BlockTemplate {
  id: string;
  session_template_id: string;
  phase: WorkoutPhase;
  category_key: string;
  order_index: number;
  label: string | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  items?: ItemTemplate[];
}

export interface ItemTemplate {
  id: string;
  block_template_id: string;
  exercise_id: string | null;
  custom_name: string | null;
  group_label: string | null;
  order_index: number;
  method_key: string | null;
  rounds: number | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  exercise?: Exercise;
  sets?: SetTemplate[];
}

export interface SetTemplate {
  id: string;
  item_template_id: string;
  set_number: number;
  set_type: string | null;
  reps: number | null;
  reps_max: number | null;
  each_side: boolean;
  load_kg: number | null;
  load_pct_1rm: number | null;
  rir: number | null;
  tempo: string | null;
  rest_seconds: number | null;
  round_number: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  target_zone: string | null;
  target_velocity_ms: number | null;
  velocity_loss_pct: number | null;
  notes: string | null;
  created_at: string;
}

// Exercise catalog DTOs (A1) — hand-written, no Zod
export interface CreateExerciseInput {
  name: string;
  movement_pattern_key?: string | null;
  default_category_key?: string | null;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  equipment?: string | null;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
  video_url?: string | null;
  cues?: string | null;
}

export interface UpdateExerciseInput extends CreateExerciseInput {
  id: string;
}

// Program builder DTOs (A2) — input to save_program_tree (migr 045)
export interface SetInput {
  set_number?: number;
  set_type?: string | null;
  reps?: number | null;
  reps_max?: number | null;
  each_side?: boolean;
  load_kg?: number | null;
  rir?: number | null;
  tempo?: string | null;
  rest_seconds?: number | null;
  round_number?: number | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
  target_zone?: string | null;
  notes?: string | null;
}

export interface ItemInput {
  id?: string | null;
  exercise_id?: string | null;
  custom_name?: string | null;
  group_label?: string | null;
  order_index?: number;
  method_key?: string | null;
  rounds?: number | null;
  notes?: string | null;
  sets: SetInput[];
}

export interface BlockInput {
  id?: string | null;
  phase: WorkoutPhase;
  category_key: string;
  order_index?: number;
  label?: string | null;
  notes?: string | null;
  items: ItemInput[];
}

export interface SessionInput {
  id?: string | null;
  name: string;
  order_index?: number;
  scheduled_days?: number[];
  notes?: string | null;
  blocks: BlockInput[];
}

export interface ProgramTreeInput {
  id?: string | null;
  name: string;
  description?: string | null;
  goal?: string | null;
  sessions: SessionInput[];
}

// Read: the A0 row interfaces nested into a full tree.
export interface ProgramTemplateTree extends ProgramTemplate {
  sessions: (SessionTemplate & {
    blocks: (BlockTemplate & {
      items: (ItemTemplate & { sets: SetTemplate[] })[];
    })[];
  })[];
}
