
-- Migration: 004_fix_rls.sql
-- Description: Ensure Manager access is robust and fix potential RLS join issues

-- 1. Ensure functions are robust
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'manager'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Managers have full access to trainers" ON trainers;

-- 3. Re-create robust policies for Managers

-- Profiles: Managers must see ALL profiles (for referencing trainers, etc.)
CREATE POLICY "Managers can view all profiles" ON profiles
    FOR SELECT
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
    );

-- Trainers: Managers must see ALL trainers
CREATE POLICY "Managers have full access to trainers" ON trainers
    FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
    );

-- Note: We are embedding the check directly to avoid function call overhead/obscurity if that was the issue,
-- though SECURITY DEFINER function is generally better. 
-- Let's stick to the function if we are sure, but for this fix, let's try the direct subquery to be explicit.
-- Actually, the direct subquery on `profiles` inside a `profiles` policy is DANGEROUS (recursion) unless we break it.
-- But `profiles` RLS acts on the *target* row. The subquery accesses `profiles` again.
-- If we use the `is_manager()` function (SECURITY DEFINER), it is safe.

-- Let's revert to using `is_manager()` but ensure it's redefined cleanly.

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'manager'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS "Managers can view all profiles" ON profiles;
CREATE POLICY "Managers can view all profiles" ON profiles
    FOR SELECT
    USING (public.is_manager());

DROP POLICY IF EXISTS "Managers have full access to trainers" ON trainers;
CREATE POLICY "Managers have full access to trainers" ON trainers
    FOR ALL
    USING (public.is_manager());
