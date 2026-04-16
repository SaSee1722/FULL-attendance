-- ── HOLIDAYS TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  department TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, department)
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Holidays viewable by department staff/hod" ON public.holidays;
DROP POLICY IF EXISTS "HODs can manage holidays" ON public.holidays;

CREATE POLICY "Holidays viewable by department staff/hod" 
ON public.holidays FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.department = holidays.department
  )
);

CREATE POLICY "HODs can manage holidays" 
ON public.holidays FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'hod' 
    AND p.department = holidays.department
  )
);

-- ── UPDATED ATTENDANCE RATE TRIGGER ─────────────────────────────
-- This trigger handles the 3% reduction for absences and 0.5% increase for recovery.

CREATE OR REPLACE FUNCTION public.update_attendance_rates()
RETURNS TRIGGER AS $$
DECLARE
  v_student_id UUID;
  v_class_id TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_student_id := OLD.student_id;
    v_class_id := OLD.class_id;
  ELSE
    v_student_id := NEW.student_id;
    v_class_id := NEW.class_id;
  END IF;

  -- Update Student Rate
  -- Logic: Start at 100%. -3% for each 'absent'/'unapproved'. 
  -- +0.5% for each 'present'/'on-duty' that happens AFTER their very first absence.
  UPDATE public.students 
  SET attendance_rate = (
    WITH stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('absent', 'unapproved')) as absences,
        MIN(date) FILTER (WHERE status IN ('absent', 'unapproved')) as first_abs_date
      FROM public.attendance_records
      WHERE student_id = v_student_id
    ),
    recovery AS (
      SELECT COUNT(*) as recovery_days
      FROM public.attendance_records
      WHERE student_id = v_student_id 
      AND status IN ('present', 'on-duty')
      AND date > (SELECT first_abs_date FROM stats)
    )
    SELECT GREATEST(0, LEAST(100, 
      100.0 
      - ((SELECT absences FROM stats) * 3.0)
      + (COALESCE((SELECT recovery_days FROM recovery), 0) * 0.5)
    ))
  )
  WHERE id = v_student_id;

  -- Update Class Rate (average of all students in that class)
  UPDATE public.classes
  SET attendance_rate = (
    SELECT COALESCE(AVG(attendance_rate), 100)
    FROM public.students
    WHERE class_id = v_class_id
  )
  WHERE id = v_class_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger if needed (or it will just use the updated function)
DROP TRIGGER IF EXISTS on_attendance_change ON public.attendance_records;
CREATE TRIGGER on_attendance_change 
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records 
FOR EACH ROW EXECUTE FUNCTION public.update_attendance_rates();
