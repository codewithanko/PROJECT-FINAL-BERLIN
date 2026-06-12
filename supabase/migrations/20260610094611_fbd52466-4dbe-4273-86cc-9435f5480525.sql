UPDATE auth.users
SET encrypted_password = crypt('Sandstone#2026!', gen_salt('bf')),
    updated_at = now()
WHERE email = 'ankotrip1@gmail.com';