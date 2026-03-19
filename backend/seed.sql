-- Kalma seed data for Mantra Pilates tenant
-- Run with: docker exec -i kalma_db psql -U kalma_user -d kalma_db < backend/seed.sql

DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id   UUID;
  v_ct1_id    UUID := gen_random_uuid();
  v_ct2_id    UUID := gen_random_uuid();
  v_ct3_id    UUID := gen_random_uuid();
  v_cl1_id    UUID := gen_random_uuid();
  v_cl2_id    UUID := gen_random_uuid();
  v_cl3_id    UUID := gen_random_uuid();
  v_cl4_id    UUID := gen_random_uuid();
  v_cl5_id    UUID := gen_random_uuid();
  v_s1_id     UUID := gen_random_uuid();
  v_s2_id     UUID := gen_random_uuid();
  v_s3_id     UUID := gen_random_uuid();
  v_s4_id     UUID := gen_random_uuid();
  v_s5_id     UUID := gen_random_uuid();
  v_s6_id     UUID := gen_random_uuid();
  v_week      TIMESTAMP;
BEGIN
  -- Get tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'mantra' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "mantra" not found. Run init first.';
  END IF;

  -- Get admin user
  SELECT id INTO v_user_id FROM users WHERE tenant_id = v_tenant_id LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found for tenant mantra.';
  END IF;

  -- Monday of the current week (ISO: week starts Monday)
  v_week := date_trunc('week', NOW());

  -- ── Class Types ──────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM class_types WHERE tenant_id = v_tenant_id) THEN
    INSERT INTO class_types (id, tenant_id, name, description, duration_minutes, capacity, price, color, is_active, created_at, updated_at)
    VALUES
      (v_ct1_id, v_tenant_id, 'Reformer Pilates',      'Clase de Pilates en máquinas Reformer de alta intensidad.',   60, 6,  120000, '#6366f1', true, NOW(), NOW()),
      (v_ct2_id, v_tenant_id, 'Mat Pilates',            'Pilates en colchoneta para todos los niveles.',               60, 10,  80000, '#10b981', true, NOW(), NOW()),
      (v_ct3_id, v_tenant_id, 'Pilates Terapéutico',   'Sesión especializada en rehabilitación y salud postural.',    60, 4,  150000, '#f59e0b', true, NOW(), NOW());
    RAISE NOTICE 'Class types created.';
  ELSE
    SELECT id INTO v_ct1_id FROM class_types WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1 OFFSET 0;
    SELECT id INTO v_ct2_id FROM class_types WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1 OFFSET 1;
    SELECT id INTO v_ct3_id FROM class_types WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1 OFFSET 2;
    IF v_ct2_id IS NULL THEN v_ct2_id := v_ct1_id; END IF;
    IF v_ct3_id IS NULL THEN v_ct3_id := v_ct1_id; END IF;
    RAISE NOTICE 'Class types already exist, reusing.';
  END IF;

  -- ── Clients ──────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM clients WHERE tenant_id = v_tenant_id) THEN
    INSERT INTO clients (id, tenant_id, full_name, email, phone, document_type, document_number, total_sessions, is_active, created_at, updated_at)
    VALUES
      (v_cl1_id, v_tenant_id, 'Valentina Torres',    'valentina@ejemplo.com', '+573001234567', 'CC', '10234567', 12, true, NOW(), NOW()),
      (v_cl2_id, v_tenant_id, 'María Pérez',          'maria@ejemplo.com',     '+573109876543', 'CC', '20345678',  8, true, NOW(), NOW()),
      (v_cl3_id, v_tenant_id, 'Ana Gómez',            'ana@ejemplo.com',       '+573203456789', 'CC', '30456789',  5, true, NOW(), NOW()),
      (v_cl4_id, v_tenant_id, 'Sofía Rodríguez',      'sofia@ejemplo.com',     '+573304567890', 'CC', '40567890',  3, true, NOW(), NOW()),
      (v_cl5_id, v_tenant_id, 'Laura Martínez',       'laura@ejemplo.com',     '+573405678901', 'CC', '50678901',  1, true, NOW(), NOW());
    RAISE NOTICE 'Clients created.';
  ELSE
    SELECT id INTO v_cl1_id FROM clients WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1 OFFSET 0;
    SELECT id INTO v_cl2_id FROM clients WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1 OFFSET 1;
    SELECT id INTO v_cl3_id FROM clients WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1 OFFSET 2;
    SELECT id INTO v_cl4_id FROM clients WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1 OFFSET 3;
    SELECT id INTO v_cl5_id FROM clients WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1 OFFSET 4;
    IF v_cl2_id IS NULL THEN v_cl2_id := v_cl1_id; END IF;
    IF v_cl3_id IS NULL THEN v_cl3_id := v_cl1_id; END IF;
    IF v_cl4_id IS NULL THEN v_cl4_id := v_cl1_id; END IF;
    IF v_cl5_id IS NULL THEN v_cl5_id := v_cl1_id; END IF;
    RAISE NOTICE 'Clients already exist, reusing.';
  END IF;

  -- ── Sessions (current week Mon-Sat, morning & afternoon) ─────
  IF NOT EXISTS (
    SELECT 1 FROM class_sessions
    WHERE tenant_id = v_tenant_id
      AND start_datetime >= v_week
      AND start_datetime  < v_week + interval '7 days'
  ) THEN
    INSERT INTO class_sessions (id, tenant_id, class_type_id, start_datetime, end_datetime, capacity, enrolled_count, status, created_at, updated_at)
    VALUES
      -- Monday
      (v_s1_id, v_tenant_id, v_ct1_id, v_week + interval  '9 hours', v_week + interval '10 hours', 6,  3, 'scheduled', NOW(), NOW()),
      (v_s2_id, v_tenant_id, v_ct2_id, v_week + interval '18 hours', v_week + interval '19 hours', 10, 5, 'scheduled', NOW(), NOW()),
      -- Tuesday
      (v_s3_id, v_tenant_id, v_ct3_id, v_week + interval '33 hours', v_week + interval '34 hours',  4, 2, 'scheduled', NOW(), NOW()),
      (v_s4_id, v_tenant_id, v_ct1_id, v_week + interval '42 hours', v_week + interval '43 hours',  6, 4, 'scheduled', NOW(), NOW()),
      -- Wednesday
      (v_s5_id, v_tenant_id, v_ct2_id, v_week + interval '58 hours', v_week + interval '59 hours', 10, 6, 'scheduled', NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_ct1_id, v_week + interval '66 hours', v_week + interval '67 hours', 6, 1, 'scheduled', NOW(), NOW()),
      -- Thursday
      (gen_random_uuid(), v_tenant_id, v_ct3_id, v_week + interval '81 hours', v_week + interval '82 hours',  4, 3, 'scheduled', NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_ct2_id, v_week + interval '90 hours', v_week + interval '91 hours', 10, 7, 'scheduled', NOW(), NOW()),
      -- Friday
      (gen_random_uuid(), v_tenant_id, v_ct1_id, v_week + interval '105 hours', v_week + interval '106 hours', 6, 5, 'scheduled', NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_ct2_id, v_week + interval '114 hours', v_week + interval '115 hours', 10, 3, 'scheduled', NOW(), NOW()),
      -- Saturday
      (v_s6_id, v_tenant_id, v_ct3_id, v_week + interval '129 hours', v_week + interval '130 hours',  4, 2, 'scheduled', NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_ct1_id, v_week + interval '138 hours', v_week + interval '139 hours', 6, 4, 'scheduled', NOW(), NOW());
    RAISE NOTICE 'Sessions created.';

    -- ── Appointments (linking clients to 3 sessions) ────────────
    INSERT INTO appointments (id, tenant_id, class_session_id, client_id, status, paid, payment_amount, payment_method, created_at, updated_at)
    VALUES
      (gen_random_uuid(), v_tenant_id, v_s1_id, v_cl1_id, 'confirmed',  true,  120000, 'transfer', NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_s1_id, v_cl2_id, 'confirmed',  true,  120000, 'nequi',    NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_s1_id, v_cl3_id, 'attended',   true,  120000, 'cash',     NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_s2_id, v_cl1_id, 'confirmed',  false, NULL,   NULL,       NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_s2_id, v_cl4_id, 'confirmed',  true,   80000, 'card',     NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_s3_id, v_cl5_id, 'pending',    false, NULL,   NULL,       NOW(), NOW());
    RAISE NOTICE 'Appointments created.';
  ELSE
    RAISE NOTICE 'Sessions for this week already exist, skipping sessions & appointments.';
  END IF;

  -- ── Payments (current month) ─────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM payments WHERE tenant_id = v_tenant_id) THEN
    INSERT INTO payments (id, tenant_id, client_id, amount, type, category, payment_method, description, payment_date, created_by, created_at, updated_at)
    VALUES
      (gen_random_uuid(), v_tenant_id, v_cl1_id, 120000, 'income',  'class_fee',  'transfer',  'Clase Reformer - Valentina Torres',  CURRENT_DATE - 14, v_user_id, NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_cl2_id,  80000, 'income',  'class_fee',  'nequi',     'Clase Mat - María Pérez',            CURRENT_DATE - 12, v_user_id, NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_cl3_id, 150000, 'income',  'class_fee',  'cash',      'Clase Terapéutica - Ana Gómez',      CURRENT_DATE - 10, v_user_id, NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_cl4_id, 240000, 'income',  'package',    'transfer',  'Paquete 2 clases - Sofía Rodríguez', CURRENT_DATE -  8, v_user_id, NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_cl5_id,  80000, 'income',  'class_fee',  'card',      'Clase Mat - Laura Martínez',         CURRENT_DATE -  5, v_user_id, NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, NULL,      850000, 'expense', 'rent',       'transfer',  'Arriendo estudio marzo',             CURRENT_DATE -  3, v_user_id, NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, NULL,      120000, 'expense', 'equipment',  'cash',      'Compra bandas elásticas',            CURRENT_DATE -  2, v_user_id, NOW(), NOW()),
      (gen_random_uuid(), v_tenant_id, v_cl1_id, 120000, 'income',  'class_fee',  'nequi',     'Clase Reformer - Valentina Torres',  CURRENT_DATE,      v_user_id, NOW(), NOW());
    RAISE NOTICE 'Payments created.';
  ELSE
    RAISE NOTICE 'Payments already exist, skipping.';
  END IF;

END $$;
