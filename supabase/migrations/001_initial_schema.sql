-- =====================================================
-- PLAYBOOK SYSTEM - INITIAL SCHEMA
-- Migration: 001_initial_schema.sql
-- Description: Core tables for the performance game
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('manager', 'trainer');
CREATE TYPE student_status AS ENUM ('active', 'cancelled', 'paused');
CREATE TYPE student_origin AS ENUM ('organic', 'referral', 'marketing');
CREATE TYPE calculation_type AS ENUM ('weighted', 'fixed');
CREATE TYPE event_type AS ENUM ('status_change', 'trainer_change', 'origin_update');

-- =====================================================
-- TABLE: profiles
-- Description: User identity and role assignment
-- =====================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'trainer',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for role-based queries
CREATE INDEX idx_profiles_role ON profiles(role);

-- =====================================================
-- TABLE: trainers
-- Description: Extended trainer profile for operational data
-- =====================================================

CREATE TABLE trainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT trainers_profile_unique UNIQUE(profile_id)
);

-- Index for active trainers
CREATE INDEX idx_trainers_active ON trainers(is_active) WHERE is_active = TRUE;

-- =====================================================
-- TABLE: students
-- Description: Studio students with trainer assignment and origin tracking
-- =====================================================

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    trainer_id UUID NOT NULL REFERENCES trainers(id),
    status student_status NOT NULL DEFAULT 'active',
    origin student_origin NOT NULL DEFAULT 'organic',
    referred_by_trainer_id UUID REFERENCES trainers(id),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    -- Referral validation: filled automatically after REFERRAL_VALIDATION_DAYS
    referral_validated_at DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraint: referred_by only when origin is referral
    CONSTRAINT students_referral_check CHECK (
        (origin = 'referral' AND referred_by_trainer_id IS NOT NULL) OR
        (origin != 'referral' AND referred_by_trainer_id IS NULL)
    )
);

-- Indexes for common queries
CREATE INDEX idx_students_trainer ON students(trainer_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_origin ON students(origin) WHERE origin = 'referral';
CREATE INDEX idx_students_referral_validation ON students(referral_validated_at) 
    WHERE origin = 'referral' AND referral_validated_at IS NOT NULL;

-- =====================================================
-- TABLE: student_events (NON-CRITICAL in MVP)
-- Description: Audit log for student state changes
-- Note: Created for future use, not populated via triggers in MVP
-- =====================================================

CREATE TABLE student_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_type event_type NOT NULL,
    old_value JSONB,
    new_value JSONB,
    event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Index for student history queries
CREATE INDEX idx_student_events_student ON student_events(student_id);
CREATE INDEX idx_student_events_date ON student_events(event_date);

-- =====================================================
-- TABLE: result_management
-- Description: Monthly checklist for KPI 03 (Results Management)
-- =====================================================

CREATE TABLE result_management (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reference_month DATE NOT NULL, -- First day of month
    has_initial_assessment BOOLEAN NOT NULL DEFAULT FALSE,
    has_reassessment BOOLEAN NOT NULL DEFAULT FALSE,
    has_documented_result BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id),
    
    CONSTRAINT result_management_month_unique UNIQUE(student_id, reference_month),
    -- Ensure reference_month is first day of month
    CONSTRAINT result_management_month_check CHECK (
        reference_month = DATE_TRUNC('month', reference_month)::DATE
    )
);

-- Index for monthly queries
CREATE INDEX idx_result_management_month ON result_management(reference_month);

-- =====================================================
-- TABLE: game_rules
-- Description: Configurable bonus rules and KPI targets
-- =====================================================

CREATE TABLE game_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    effective_from DATE NOT NULL,
    effective_until DATE,
    calculation_type calculation_type NOT NULL DEFAULT 'fixed',
    
    -- Unified KPI configuration
    -- Contains: min_portfolio_size, referral_validation_days, and per-KPI config
    kpi_config JSONB NOT NULL DEFAULT '{
        "min_portfolio_size": 5,
        "referral_validation_days": 30,
        "retention": {
            "enabled": true,
            "target": 90.00,
            "weight": 40,
            "fixed_value": 200.00
        },
        "referrals": {
            "enabled": true,
            "target": 1,
            "weight": 30,
            "fixed_value": 150.00
        },
        "management": {
            "enabled": true,
            "target": 75.00,
            "weight": 30,
            "fixed_value": 150.00
        }
    }'::JSONB,
    
    -- Base amount for weighted calculation
    base_reward_amount DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    -- Only one active rule at a time
    CONSTRAINT game_rules_single_active CHECK (
        NOT is_active OR effective_until IS NULL OR effective_until >= CURRENT_DATE
    )
);

-- Index for active rules
CREATE INDEX idx_game_rules_active ON game_rules(is_active, effective_from);

-- =====================================================
-- TABLE: performance_snapshots
-- Description: Monthly immutable snapshot of trainer performance
-- =====================================================

CREATE TABLE performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id),
    reference_month DATE NOT NULL, -- First day of month
    
    -- KPI 01: Retention
    students_start INTEGER NOT NULL DEFAULT 0,
    students_end INTEGER NOT NULL DEFAULT 0,
    cancellations INTEGER NOT NULL DEFAULT 0,
    retention_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    retention_target DECIMAL(5,2) NOT NULL DEFAULT 90.00,
    retention_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    retention_achieved BOOLEAN GENERATED ALWAYS AS (
        retention_eligible AND retention_rate >= retention_target
    ) STORED,
    
    -- KPI 02: Referrals
    referrals_count INTEGER NOT NULL DEFAULT 0,
    referrals_target INTEGER NOT NULL DEFAULT 1,
    referrals_achieved BOOLEAN GENERATED ALWAYS AS (
        referrals_count >= referrals_target
    ) STORED,
    
    -- KPI 03: Management
    portfolio_size INTEGER NOT NULL DEFAULT 0,
    managed_count INTEGER NOT NULL DEFAULT 0,
    management_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    management_target DECIMAL(5,2) NOT NULL DEFAULT 75.00,
    management_achieved BOOLEAN GENERATED ALWAYS AS (
        management_rate >= management_target
    ) STORED,
    
    -- Reward calculation
    game_rule_id UUID REFERENCES game_rules(id),
    reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Snapshot control
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at TIMESTAMPTZ,
    finalized_by UUID REFERENCES profiles(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT performance_snapshots_unique UNIQUE(trainer_id, reference_month),
    -- Ensure reference_month is first day of month
    CONSTRAINT performance_snapshots_month_check CHECK (
        reference_month = DATE_TRUNC('month', reference_month)::DATE
    )
);

-- Indexes for common queries
CREATE INDEX idx_performance_snapshots_trainer ON performance_snapshots(trainer_id);
CREATE INDEX idx_performance_snapshots_month ON performance_snapshots(reference_month);
CREATE INDEX idx_performance_snapshots_finalized ON performance_snapshots(is_finalized);

-- =====================================================
-- TRIGGERS: Updated_at automation
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trainers_updated_at
    BEFORE UPDATE ON trainers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_result_management_updated_at
    BEFORE UPDATE ON result_management
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_performance_snapshots_updated_at
    BEFORE UPDATE ON performance_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGER: Prevent modification of finalized snapshots
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_finalized_snapshot_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_finalized = TRUE THEN
        RAISE EXCEPTION 'Cannot modify a finalized performance snapshot';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_snapshot_modification
    BEFORE UPDATE ON performance_snapshots
    FOR EACH ROW EXECUTE FUNCTION prevent_finalized_snapshot_modification();
