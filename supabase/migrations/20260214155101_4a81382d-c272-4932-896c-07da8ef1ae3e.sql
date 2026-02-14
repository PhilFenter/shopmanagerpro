-- Make job-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'job-photos';
