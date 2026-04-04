
-- Reclassify SOPs by department
UPDATE sops SET category = 'Embroidery' WHERE department = 'Embroidery';
UPDATE sops SET category = 'Screen Printing' WHERE department = 'Screen Print';
UPDATE sops SET category = 'DTF Printing' WHERE department = 'DTF';
UPDATE sops SET category = 'Laser Engraving' WHERE department = 'Leather';
UPDATE sops SET category = 'Art Prep' WHERE department = 'Art';
UPDATE sops SET category = 'Shipping & Receiving' WHERE department = 'Shipping';
UPDATE sops SET category = 'Shop Procedures' WHERE department = 'General';
UPDATE sops SET category = 'Shop Procedures' WHERE department = 'Pressing';
UPDATE sops SET category = 'Shop Procedures' WHERE department = 'HCD Confluence' AND category = 'User Guide';

-- Reclassify checklist templates by department
UPDATE checklist_templates SET category = 'Embroidery' WHERE department = 'Embroidery';
UPDATE checklist_templates SET category = 'Screen Printing' WHERE department = 'Screen Print';
UPDATE checklist_templates SET category = 'DTF Printing' WHERE department = 'DTF';
UPDATE checklist_templates SET category = 'Laser Engraving' WHERE department = 'Leather';
UPDATE checklist_templates SET category = 'Art Prep' WHERE department = 'Art';
UPDATE checklist_templates SET category = 'Shipping & Receiving' WHERE department = 'Shipping';
UPDATE checklist_templates SET category = 'Shop Procedures' WHERE department = 'General';
UPDATE checklist_templates SET category = 'Shop Procedures' WHERE department = 'HCD Confluence' AND category = 'User Guide';

-- Also update departments to match new names
UPDATE sops SET department = 'Embroidery' WHERE department = 'Embroidery';
UPDATE sops SET department = 'Screen Printing' WHERE department = 'Screen Print';
UPDATE sops SET department = 'DTF Printing' WHERE department = 'DTF';
UPDATE sops SET department = 'Laser Engraving' WHERE department = 'Leather';
UPDATE sops SET department = 'Art Prep' WHERE department = 'Art';
UPDATE sops SET department = 'Shipping & Receiving' WHERE department = 'Shipping';
UPDATE sops SET department = 'Shop Procedures' WHERE department IN ('General', 'Pressing', 'HCD Confluence');

UPDATE checklist_templates SET department = 'Embroidery' WHERE department = 'Embroidery';
UPDATE checklist_templates SET department = 'Screen Printing' WHERE department = 'Screen Print';
UPDATE checklist_templates SET department = 'DTF Printing' WHERE department = 'DTF';
UPDATE checklist_templates SET department = 'Laser Engraving' WHERE department = 'Leather';
UPDATE checklist_templates SET department = 'Art Prep' WHERE department = 'Art';
UPDATE checklist_templates SET department = 'Shipping & Receiving' WHERE department = 'Shipping';
UPDATE checklist_templates SET department = 'Shop Procedures' WHERE department IN ('General', 'HCD Confluence');
