
-- Insert Screen Printing Job Setup SOP
INSERT INTO sops (id, title, description, category, department, status, tags, created_by)
VALUES (
  'b1a2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
  'Screen Printing Job Setup',
  'Comprehensive setup procedure for screen print jobs — from artwork review and screen prep through press setup, test prints, production run, and quality control sign-off.',
  'Production',
  'Screen Print',
  'published',
  ARRAY['screen-print', 'job-setup', 'press-setup', 'registration', 'ink-prep', 'quality-control'],
  (SELECT id FROM auth.users LIMIT 1)
);

-- Steps
INSERT INTO sop_steps (sop_id, sort_order, title, content, tip, warning) VALUES
('b1a2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', 0,
 'Artwork & Job Review',
 'Review the job ticket and verify all details before touching any equipment:
• Confirm design file name and location
• Verify artwork dimensions (width × height)
• Confirm color specifications — Pantone codes and order of color application
• Identify all print locations on garment (front, back, sleeve, etc.)
• Note specific placement measurements from garment reference points (e.g., "3 inches below collar")
• Confirm garment type, sizes, and total quantity
• Check due date and production priority',
 'Print out a paper proof of the artwork at actual size to use as a visual reference on press.',
 'Do NOT start pulling screens until the artwork and job details are fully confirmed. Changes mid-setup waste screens and time.'),

('b1a2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', 1,
 'Screen Preparation',
 'Select and prepare screens for the job:
• Choose mesh count based on ink type and artwork detail level
• Verify screens are clean, degreased, and completely dry
• Coat screens with appropriate emulsion — note type and number of coats per side
• Dry screens horizontally, ink side up
• Image screens on Douthitt CTS with correct artwork files
• Expose screens using LED unit — consult HCD Exposure Time Chart
• Develop screens in water dip tank and washout booth
• Dry and inspect stencils — no pinholes, sharp edges, solid emulsion in non-image areas
• Tape screens on ink side, sealing all edges and pinholes',
 'Refer to the Screen Coating and Imaging & Exposure SOPs for detailed procedures.',
 'Screens must be COMPLETELY DRY before exposure. Wet screens will cause soft stencils and breakdown on press.'),

('b1a2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', 2,
 'Ink Preparation',
 'Prepare all inks needed for the job:
• Identify ink type: Plastisol, Water-based, Discharge, etc.
• Mix inks to match Pantone specs — record mixing ratios
• Add any required additives or modifiers (reducer, fixer, soft hand additive, etc.)
• Ensure inks are at proper working consistency
• Label all ink containers with job number and color name',
 'Mix slightly more ink than you think you need — running out mid-run causes color matching issues.',
 'Always wear gloves when handling discharge inks and work in a ventilated area.'),

('b1a2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', 3,
 'Press Setup',
 'Configure the printing press for production:
• Select press type (manual or automatic)
• Install correct platen size and type (adult, youth, sleeve, etc.)
• Load screens onto press in correct print order
• Set off-contact distance between screen and substrate
• Install squeegees — select correct durometer hardness
• Set squeegee angle and pressure
• Align all screens for proper registration using registration marks
• Set flash cure temperature and time for multi-color jobs',
 'Start with lighter colors first, darker colors last in the print sequence.',
 'Double-check off-contact distance — too much causes poor ink deposit, too little causes smearing.'),

('b1a2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', 4,
 'Test Print & Adjustments',
 'Run test prints before starting the production run:
• Print on a test garment (same style and color as production)
• Check registration accuracy across all colors
• Verify color accuracy against Pantone specs or approved proof
• Inspect print quality — coverage, sharpness, ink deposit
• Check flash cure between colors — ink should be dry to touch, not fully cured
• Make any necessary adjustments to registration, pressure, squeegee angle, or ink
• Document all adjustments made
• Get setup approval before starting production',
 'Keep your test prints — they serve as a reference if quality drifts during the run.',
 NULL),

('b1a2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', 5,
 'Production Run',
 'Execute the production print run:
• Follow established print sequence (color order)
• Flash cure between color layers at correct temperature and duration
• Maintain consistent squeegee speed and pressure throughout
• Monitor registration and print quality every 10-15 prints
• Final cure all printed garments through conveyor dryer at correct temperature and belt speed
• Stack or rack finished garments to prevent ink transfer
• Track count against order quantity',
 'If you notice quality drift, stop and re-check registration and ink levels before continuing.',
 'Do NOT skip final curing — under-cured prints will fail wash testing and cost a reprint.'),

('b1a2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', 6,
 'Quality Control & Sign-Off',
 'Inspect the completed run and document results:
• Check registration accuracy on random samples
• Verify color fidelity matches approved proof
• Test ink adhesion — stretch test and tape test on cured prints
• Inspect overall print quality — no pinholes, smearing, or ghosting
• Count finished goods against order quantity
• Handle any misprints or defects per shop defect management process
• Record operator name, any assistants, and completion time
• Sign off on the job — operator signature and date/time',
 'Pull 2-3 pieces for wash testing on longer or higher-value runs.',
 'Any defective prints must be separated and documented — do not ship defects to the customer.');

-- Matching Checklist Template
INSERT INTO checklist_templates (id, title, description, category, department, items, created_by)
VALUES (
  'b1a2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5e7',
  'Screen Print Job Setup Checklist',
  'Complete checklist for setting up and running a screen print job from artwork review through quality sign-off.',
  'Production',
  'Screen Print',
  '[
    {"text": "Job ticket reviewed — artwork file, dimensions, colors, print locations confirmed", "required": true},
    {"text": "Garment type, sizes, and quantity verified", "required": true},
    {"text": "Due date and production priority confirmed", "required": true},
    {"text": "Correct mesh count screens selected for ink type and detail level", "required": true},
    {"text": "Screens coated, imaged, exposed, and developed per SOP", "required": true},
    {"text": "Stencils inspected — no pinholes, sharp edges, solid emulsion", "required": true},
    {"text": "Screens taped and sealed on ink side", "required": true},
    {"text": "Inks mixed to Pantone spec — ratios recorded", "required": true},
    {"text": "Additives/modifiers added as needed", "required": false},
    {"text": "Ink containers labeled with job number and color name", "required": true},
    {"text": "Correct platen size and type installed", "required": true},
    {"text": "Screens loaded in correct print order", "required": true},
    {"text": "Off-contact distance set", "required": true},
    {"text": "Squeegees installed — correct durometer, angle, and pressure", "required": true},
    {"text": "Registration aligned across all colors", "required": true},
    {"text": "Flash cure temperature and time set for multi-color", "required": true},
    {"text": "Test print completed on correct garment", "required": true},
    {"text": "Registration, color accuracy, and print quality approved", "required": true},
    {"text": "Setup approval obtained before production run", "required": true},
    {"text": "Production run completed — consistent quality maintained", "required": true},
    {"text": "Final cure through conveyor dryer at correct temp and speed", "required": true},
    {"text": "Random samples inspected for registration and color fidelity", "required": true},
    {"text": "Ink adhesion verified (stretch test / tape test)", "required": false},
    {"text": "Finished count matches order quantity", "required": true},
    {"text": "Misprints/defects separated and documented", "required": true},
    {"text": "Operator sign-off completed with date/time", "required": true}
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
);
