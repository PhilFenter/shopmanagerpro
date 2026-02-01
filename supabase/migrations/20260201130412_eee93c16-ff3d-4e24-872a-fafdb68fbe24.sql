-- Add new service types for patches
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'uv_patch';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'heat_press_patch';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'woven_patch';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'pvc_patch';