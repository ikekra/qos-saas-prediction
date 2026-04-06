-- Grant admin role to a specific project owner account
DO $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'::jsonb,
    true
  )
  WHERE lower(email) = 'chagankekra13@gmail.com';

  IF NOT FOUND THEN
    RAISE NOTICE 'No auth user found for chagankekra13@gmail.com';
  ELSE
    RAISE NOTICE 'Granted admin role to chagankekra13@gmail.com';
  END IF;
END $$;
