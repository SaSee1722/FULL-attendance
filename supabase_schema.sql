-- Users profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('dean', 'staff')) NOT NULL DEFAULT 'staff',
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id TEXT PRIMARY KEY, -- e.g. CS-2024-A
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  year TEXT NOT NULL,
  section TEXT NOT NULL,
  advisor TEXT NOT NULL,
  student_count INTEGER DEFAULT 0,
  attendance_rate FLOAT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  roll_no TEXT UNIQUE NOT NULL,
  class_id TEXT REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  attendance_rate FLOAT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance records
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  class_id TEXT REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'on-duty', 'unapproved')) NOT NULL,
  marked_by UUID REFERENCES public.profiles(id) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- Holidays table
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  department TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, department)
);

-- Activity logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  details TEXT NOT NULL,
  department TEXT NOT NULL,
  marked_by TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);


-- ── DROP EXISTING POLICIES ───────────────────
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Classes viewable by relevant department staff/dean" ON public.classes;
DROP POLICY IF EXISTS "Deans can manage classes in their department" ON public.classes;
DROP POLICY IF EXISTS "Students viewable by relevant staff/dean" ON public.students;
DROP POLICY IF EXISTS "Deans can manage students" ON public.students;
DROP POLICY IF EXISTS "Attendance records viewable by staff/dean" ON public.attendance_records;
DROP POLICY IF EXISTS "Staff can mark attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Holidays viewable by department" ON public.holidays;
DROP POLICY IF EXISTS "Deans can manage holidays" ON public.holidays;
DROP POLICY IF EXISTS "Activity logs viewable by department" ON public.activity_logs;

-- Policies for Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Policies for Classes
CREATE POLICY "Classes viewable by relevant department staff/dean" 
ON public.classes FOR SELECT 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'dean' 
  AND LOWER(department) = LOWER((SELECT department FROM public.profiles WHERE id = auth.uid()))
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'staff' 
  AND (LOWER(advisor) = LOWER((SELECT name FROM public.profiles WHERE id = auth.uid())) OR LOWER(department) = LOWER((SELECT department FROM public.profiles WHERE id = auth.uid())))
);

CREATE POLICY "Deans can manage classes in their department" 
ON public.classes FOR ALL 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'dean' 
  AND LOWER(department) = LOWER((SELECT department FROM public.profiles WHERE id = auth.uid()))
);

-- Policies for Students
CREATE POLICY "Students viewable by relevant staff/dean" 
ON public.students FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = students.class_id
    AND (
      (p.role = 'dean' AND LOWER(c.department) = LOWER(p.department)) 
      OR (p.role = 'staff' AND LOWER(c.advisor) = LOWER(p.name))
    )
  )
);

CREATE POLICY "Deans can manage students" 
ON public.students FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = students.class_id
    AND p.role = 'dean' AND LOWER(c.department) = LOWER(p.department)
  )
);

-- Policies for Attendance
CREATE POLICY "Attendance records viewable by staff/dean" 
ON public.attendance_records FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = attendance_records.class_id
    AND (
      (p.role = 'dean' AND LOWER(c.department) = LOWER(p.department)) 
      OR (p.role = 'staff' AND LOWER(c.advisor) = LOWER(p.name))
    )
  )
);

CREATE POLICY "Staff can mark attendance" 
ON public.attendance_records FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = attendance_records.class_id
    AND (
      (p.role = 'staff' AND LOWER(c.advisor) = LOWER(p.name))
      OR (p.role = 'dean' AND LOWER(c.department) = LOWER(p.department))
    )
  )
);

-- Policies for Holidays
CREATE POLICY "Holidays viewable by department" 
ON public.holidays FOR SELECT 
USING (
  LOWER(department) = LOWER((SELECT department FROM public.profiles WHERE id = auth.uid()))
);

CREATE POLICY "Deans can manage holidays" 
ON public.holidays FOR ALL 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'dean'
  AND LOWER(department) = LOWER((SELECT department FROM public.profiles WHERE id = auth.uid()))
);

-- Policies for Activity Logs
CREATE POLICY "Activity logs viewable by department" 
ON public.activity_logs FOR SELECT 
USING (
  LOWER(department) = LOWER((SELECT department FROM public.profiles WHERE id = auth.uid()))
);

CREATE POLICY "Anyone can log activity" 
ON public.activity_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);


-- ── TRIGGERS ──────────────────
DROP TRIGGER IF EXISTS on_student_change ON public.students;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_attendance_change ON public.attendance_records;

CREATE OR REPLACE FUNCTION public.update_class_student_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.classes SET student_count = student_count + 1 WHERE id = NEW.class_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.classes SET student_count = student_count - 1 WHERE id = OLD.class_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff'),
    NEW.raw_user_meta_data->>'department'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

  UPDATE public.students 
  SET attendance_rate = (
    WITH stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE status = 'absent' OR status = 'unapproved') as absences,
        MIN(date) FILTER (WHERE status = 'absent' OR status = 'unapproved') as first_abs_date
      FROM public.attendance_records
      WHERE student_id = v_student_id
    ),
    recoveries AS (
      SELECT COUNT(*) as count
      FROM public.attendance_records r, stats s
      WHERE r.student_id = v_student_id
      AND (r.status = 'present' OR r.status = 'on-duty')
      AND r.date > s.first_abs_date
    )
    SELECT GREATEST(0, LEAST(100, 
      100.0 - (COALESCE((SELECT absences FROM stats), 0) * 3.0) + (COALESCE((SELECT count FROM recoveries), 0) * 0.5)
    ))
  )
  WHERE id = v_student_id;

  UPDATE public.classes
  SET attendance_rate = (
    SELECT COALESCE(AVG(attendance_rate), 0)
    FROM public.students
    WHERE class_id = v_class_id
  )
  WHERE id = v_class_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_student_change AFTER INSERT OR DELETE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_class_student_count();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_attendance_change AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_attendance_rates();
