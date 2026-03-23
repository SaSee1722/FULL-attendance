-- Drop existing tables (with CASCADE to handle dependencies)
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'dean', 'staff')),
  department TEXT,
  verified BOOLEAN DEFAULT true,
  assigned_classes TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create classes table
CREATE TABLE public.classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  year TEXT NOT NULL,
  section TEXT NOT NULL,
  advisor TEXT NOT NULL,
  student_count INTEGER DEFAULT 0,
  attendance_rate FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create students table
CREATE TABLE public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  roll_no TEXT NOT NULL UNIQUE,
  class_id TEXT REFERENCES public.classes(id) ON DELETE CASCADE,
  attendance_rate FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'on-duty', 'unapproved')),
  marked_by UUID REFERENCES public.profiles(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  department TEXT,
  role TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Classes Policies
CREATE POLICY "Anyone can view classes" ON public.classes FOR SELECT USING (true);

CREATE POLICY "Admins can manage all classes" ON public.classes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Deans can insert department classes" ON public.classes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() 
    AND role = 'dean' AND department = classes.department
  )
);

CREATE POLICY "Deans can update department classes" ON public.classes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() 
    AND role = 'dean' AND department = classes.department
  )
);

CREATE POLICY "Deans can delete department classes" ON public.classes FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() 
    AND role = 'dean' AND department = classes.department
  )
);

-- Students Policies
CREATE POLICY "Anyone can view students" ON public.students FOR SELECT USING (true);

CREATE POLICY "Admins can insert students" ON public.students FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Deans/Staff can insert department students" ON public.students FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND (p.role = 'dean' OR p.role = 'staff') 
    AND p.department = (SELECT department FROM public.classes WHERE id = class_id)
  )
);

CREATE POLICY "Admins can update students" ON public.students FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Deans/Staff can update department students" ON public.students FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND (p.role = 'dean' OR p.role = 'staff') 
    AND p.department = (SELECT department FROM public.classes WHERE id = students.class_id)
  )
);

CREATE POLICY "Admins can delete students" ON public.students FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Deans/Staff can delete department students" ON public.students FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND (p.role = 'dean' OR p.role = 'staff') 
    AND p.department = (SELECT department FROM public.classes WHERE id = students.class_id)
  )
);

-- Attendance Policies
CREATE POLICY "Attendance records are viewable by everyone" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Staff can mark attendance" ON public.attendance_records FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'staff' OR role = 'dean' OR role = 'admin'))
);

-- Activity Logs Policies
CREATE POLICY "Activity logs are viewable by department staff" ON public.activity_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR department = activity_logs.department))
);

-- Trigger to update student_count in classes table
CREATE OR REPLACE FUNCTION public.update_class_student_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.classes
    SET student_count = student_count + 1
    WHERE id = NEW.class_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.classes
    SET student_count = GREATEST(0, student_count - 1)
    WHERE id = OLD.class_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.class_id IS DISTINCT FROM NEW.class_id) THEN
    -- If class_id changed (rare but possible)
    UPDATE public.classes
    SET student_count = GREATEST(0, student_count - 1)
    WHERE id = OLD.class_id;
    UPDATE public.classes
    SET student_count = student_count + 1
    WHERE id = NEW.class_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_student_change
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_class_student_count();

-- Function to handle new user signup
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

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
