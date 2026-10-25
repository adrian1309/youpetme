-- Defence in depth for the 100-character limit on first and last names (TS-IAM-001).
-- char_length counts characters, matching the application's code-point count.
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_first_name_length_check" CHECK (char_length("first_name") <= 100);
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_last_name_length_check" CHECK (char_length("last_name") <= 100);
